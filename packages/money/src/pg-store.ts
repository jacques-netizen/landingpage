// Postgres implementation of the money store, on Drizzle. Row locks use SELECT ... FOR UPDATE.
import { getSettings, tables, writeAudit, type Db, type Tx } from '@mde/db'
import { and, eq, sql } from 'drizzle-orm'
import type { AccountRef, MoneyStore, MoneyTx } from './store'

const refKey = (r: AccountRef) => `${r.kind}|${r.ownerType}|${r.ownerId ?? ''}`

function pgTx(tx: Tx): MoneyTx {
  return {
    async lockAccounts(refs) {
      const ids = new Map<string, string>()
      // Lock in a stable order so two operations locking the same accounts cannot deadlock.
      for (const r of [...refs].sort((a, b) => refKey(a).localeCompare(refKey(b)))) {
        await tx
          .insert(tables.ledgerAccounts)
          .values({ kind: r.kind, ownerType: r.ownerType, ownerId: r.ownerId })
          .onConflictDoNothing()
        const rows = await tx.execute<{ id: string }>(sql`
          select id from ledger_accounts
          where kind = ${r.kind} and owner_type = ${r.ownerType} and owner_id is not distinct from ${r.ownerId}
          for update`)
        ids.set(refKey(r), rows[0]!.id)
      }
      return refs.map((r) => ids.get(refKey(r))!)
    },

    async balance(accountId) {
      const rows = await tx.execute<{ b: string }>(
        sql`select coalesce(sum(amount_cents), 0)::bigint as b from ledger_entries where account_id = ${accountId}`,
      )
      return Number(rows[0]!.b)
    },

    async insertTransaction(t, entries) {
      const [row] = await tx
        .insert(tables.ledgerTransactions)
        .values({
          kind: t.kind,
          idempotencyKey: t.idempotencyKey,
          campaignId: t.campaignId ?? null,
          submissionId: t.submissionId ?? null,
          creatorId: t.creatorId ?? null,
          payoutId: t.payoutId ?? null,
          memo: t.memo ?? null,
          createdBy: t.createdBy ?? null,
        })
        .onConflictDoNothing({ target: tables.ledgerTransactions.idempotencyKey })
        .returning({ id: tables.ledgerTransactions.id })
      if (!row) {
        const [existing] = await tx
          .select({ id: tables.ledgerTransactions.id })
          .from(tables.ledgerTransactions)
          .where(eq(tables.ledgerTransactions.idempotencyKey, t.idempotencyKey))
        return { id: existing!.id, created: false }
      }
      await tx
        .insert(tables.ledgerEntries)
        .values(entries.map((e) => ({ transactionId: row.id, accountId: e.accountId, amountCents: e.amountCents })))
      return { id: row.id, created: true }
    },

    async transactionExists(key) {
      const rows = await tx
        .select({ id: tables.ledgerTransactions.id })
        .from(tables.ledgerTransactions)
        .where(eq(tables.ledgerTransactions.idempotencyKey, key))
      return rows.length > 0
    },

    async countSubmissionTransactions(submissionId) {
      const rows = await tx.execute<{ n: string }>(
        sql`select count(*)::bigint as n from ledger_transactions where submission_id = ${submissionId}`,
      )
      return Number(rows[0]!.n)
    },

    async countCampaignTransactions(campaignId, kind) {
      const rows = await tx.execute<{ n: string }>(
        sql`select count(*)::bigint as n from ledger_transactions where campaign_id = ${campaignId} and kind = ${kind}`,
      )
      return Number(rows[0]!.n)
    },

    async campaign(id) {
      const [c] = await tx.select().from(tables.campaigns).where(eq(tables.campaigns.id, id))
      if (!c) return null
      return {
        id: c.id,
        clientId: c.clientId!,
        status: c.status,
        budgetCents: c.budgetCents,
        capPerPostCents: c.capPerPostCents,
        capPerCreatorCents: c.capPerCreatorCents,
        minViewsToEarn: c.minViewsToEarn,
      }
    },

    async setCampaignStatus(id, status) {
      await tx.update(tables.campaigns).set({ status }).where(eq(tables.campaigns.id, id))
    },

    async setCampaignBudget(id, budgetCents) {
      await tx.update(tables.campaigns).set({ budgetCents }).where(eq(tables.campaigns.id, id))
    },

    async clientServiceFeeBps(clientId) {
      const [c] = await tx
        .select({ bps: tables.clients.serviceFeeBps })
        .from(tables.clients)
        .where(eq(tables.clients.id, clientId))
      return c ? c.bps : null
    },

    async submission(id, lock) {
      const q = tx
        .select({
          id: tables.submissions.id,
          campaignId: tables.submissions.campaignId,
          creatorId: tables.submissions.creatorId,
          state: tables.submissions.state,
          countedViews: tables.submissions.countedViews,
          earnedCents: tables.submissions.earnedCents,
          rateCentsPer1000Locked: tables.submissions.rateCentsPer1000Locked,
        })
        .from(tables.submissions)
        .where(eq(tables.submissions.id, id))
      const [s] = lock ? await q.for('update') : await q
      return s ?? null
    },

    async setSubmission(id, patch) {
      await tx.update(tables.submissions).set(patch).where(eq(tables.submissions.id, id))
    },

    async creatorEarnedInCampaign(creatorId, campaignId, excludeSubmissionId) {
      const rows = await tx.execute<{ n: string }>(sql`
        select coalesce(sum(earned_cents), 0)::bigint as n from submissions
        where creator_id = ${creatorId} and campaign_id = ${campaignId} and id <> ${excludeSubmissionId}`)
      return Number(rows[0]!.n)
    },

    async hasOpenFlagOrAppeal(submissionId) {
      const flags = await tx
        .select({ id: tables.fraudFlags.id })
        .from(tables.fraudFlags)
        .where(and(eq(tables.fraudFlags.submissionId, submissionId), eq(tables.fraudFlags.status, 'open')))
      if (flags.length) return true
      const appeals = await tx
        .select({ id: tables.appeals.id })
        .from(tables.appeals)
        .where(and(eq(tables.appeals.submissionId, submissionId), eq(tables.appeals.status, 'open')))
      return appeals.length > 0
    },

    async lockCreator(creatorId) {
      const rows = await tx.execute<{ payout_status: string; status: string }>(sql`
        select p.payout_status, u.status from creator_profiles p join users u on u.id = p.user_id
        where p.user_id = ${creatorId} for update of p`)
      const r = rows[0]
      return r ? { payoutStatus: r.payout_status, userStatus: r.status } : null
    },

    async hasRequestedWithdrawal(creatorId) {
      const rows = await tx
        .select({ id: tables.withdrawals.id })
        .from(tables.withdrawals)
        .where(and(eq(tables.withdrawals.creatorId, creatorId), eq(tables.withdrawals.status, 'requested')))
      return rows.length > 0
    },

    async insertWithdrawal(w) {
      const [row] = await tx
        .insert(tables.withdrawals)
        .values({ ...w, status: 'requested' })
        .returning({ id: tables.withdrawals.id })
      return row!.id
    },

    async withdrawal(id, lock) {
      const q = tx.select().from(tables.withdrawals).where(eq(tables.withdrawals.id, id))
      const [w] = lock ? await q.for('update') : await q
      if (!w) return null
      return {
        id: w.id,
        creatorId: w.creatorId,
        method: w.method as 'stripe_connect' | 'paypal',
        amountCents: w.amountCents,
        feeCents: w.feeCents,
        netCents: w.netCents,
        status: w.status,
      }
    },

    async setWithdrawal(id, patch) {
      await tx.update(tables.withdrawals).set(patch).where(eq(tables.withdrawals.id, id))
    },

    async feeSettings() {
      const s = await getSettings(tx)
      return {
        withdrawal_fee_bps: s.withdrawal_fee_bps,
        withdrawal_fee_min_cents: s.withdrawal_fee_min_cents,
        withdrawal_min_cents: s.withdrawal_min_cents,
      }
    },

    async audit(e) {
      await writeAudit(tx, e)
    },
  }
}

export function createPgStore(db: Db): MoneyStore {
  return {
    transaction: (fn) => db.transaction((tx) => fn(pgTx(tx))),
  }
}
