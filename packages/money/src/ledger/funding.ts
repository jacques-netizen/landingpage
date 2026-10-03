import { eq } from 'drizzle-orm'
import { campaigns, clients, ledgerTransactions, type Database } from '@mde/db'
import { serviceFee } from '../fees'
import { accounts, balanceOf, lockAccounts } from './accounts'
import { auditIfStaff } from './audit'
import { postTransaction } from './post'

/**
 * Finance records money the client has paid by invoice or bank transfer. External goes down, the
 * client's holding account goes up. A reference (for example the invoice number) makes it safe to repeat.
 */
export async function recordClientFunding(
  db: Database,
  input: {
    clientId: string
    amountCents: bigint
    reference: string
    actorId: string | null
    campaignId?: string
    memo?: string
  },
) {
  if (input.amountCents <= 0n) throw new Error('Funding must be more than zero')
  return db.transaction(async (tx) => {
    const [external, holding] = await Promise.all([
      accounts.external(tx),
      accounts.clientHolding(tx, input.clientId),
    ])
    await lockAccounts(tx, [external, holding])
    const res = await postTransaction(tx, {
      kind: 'client_funding_received',
      idempotencyKey: `funding_received:${input.clientId}:${input.reference}`,
      entries: [
        { accountId: external, amountCents: -input.amountCents },
        { accountId: holding, amountCents: input.amountCents },
      ],
      campaignId: input.campaignId,
      memo: input.memo ?? input.reference,
      createdBy: input.actorId,
    })
    if (res.created) {
      await auditIfStaff(tx, input.actorId, {
        action: 'funding.record',
        entity: 'client',
        entityId: input.clientId,
        before: null,
        after: { amountCents: input.amountCents.toString(), reference: input.reference },
      })
    }
    return res
  })
}

/**
 * Moves the whole budget into the campaign, and the service fee to platform revenue.
 * All or nothing: a campaign cannot be partly funded. Safe to call twice.
 */
export async function fundCampaign(
  db: Database,
  input: { campaignId: string; actorId: string | null },
) {
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, input.campaignId))
      .limit(1)
    if (!campaign) throw new Error('No such campaign')
    const [client] = await tx
      .select()
      .from(clients)
      .where(eq(clients.id, campaign.clientId))
      .limit(1)
    if (!client) throw new Error('No such client')

    const [holding, budget, revenue] = await Promise.all([
      accounts.clientHolding(tx, client.id),
      accounts.campaignBudget(tx, campaign.id),
      accounts.platformRevenue(tx),
    ])
    await lockAccounts(tx, [holding, budget, revenue])

    const done = await tx
      .select({ id: ledgerTransactions.id })
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.idempotencyKey, `campaign_funded:${campaign.id}`))
      .limit(1)
    const budgetCents = campaign.budgetCents
    const feeCents = serviceFee(budgetCents, client.serviceFeeBps)
    if (done[0]) return { created: false, budgetCents, feeCents }

    const held = await balanceOf(tx, holding)
    if (held < budgetCents + feeCents) {
      throw new Error(
        `The client has not funded this campaign in full: ${budgetCents + feeCents} cents needed, ${held} cents received`,
      )
    }

    await postTransaction(tx, {
      kind: 'campaign_funded',
      idempotencyKey: `campaign_funded:${campaign.id}`,
      entries: [
        { accountId: holding, amountCents: -budgetCents },
        { accountId: budget, amountCents: budgetCents },
      ],
      campaignId: campaign.id,
      createdBy: input.actorId,
    })
    if (feeCents > 0n) {
      await postTransaction(tx, {
        kind: 'service_fee_taken',
        idempotencyKey: `service_fee_taken:${campaign.id}`,
        entries: [
          { accountId: holding, amountCents: -feeCents },
          { accountId: revenue, amountCents: feeCents },
        ],
        campaignId: campaign.id,
        createdBy: input.actorId,
      })
    }
    await auditIfStaff(tx, input.actorId, {
      action: 'campaign.fund',
      entity: 'campaign',
      entityId: campaign.id,
      before: null,
      after: { budgetCents: budgetCents.toString(), serviceFeeCents: feeCents.toString() },
    })
    return { created: true, budgetCents, feeCents }
  })
}
