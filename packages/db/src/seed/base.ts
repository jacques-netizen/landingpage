import { reasonCodeSeeds, settingsDefaults } from '@mde/config'
import { sql } from 'drizzle-orm'
import type { Database } from '../client'
import { ledgerAccounts, reasonCodes, settings } from '../schema'

/** Real, non invented data every environment needs: settings, reason codes, platform ledger accounts. Safe to run twice. */
export async function seedBase(db: Database) {
  await db
    .insert(settings)
    .values(Object.entries(settingsDefaults).map(([key, value]) => ({ key, value })))
    .onConflictDoNothing()

  await db
    .insert(reasonCodes)
    .values(
      reasonCodeSeeds.map((r) => ({
        code: r.code,
        label: r.label,
        appliesTo: r.appliesTo,
        creatorMessage: r.creatorMessage,
      })),
    )
    .onConflictDoNothing()

  // One external, one payout_in_transit and one platform_revenue account.
  for (const [kind, ownerType] of [
    ['external', null],
    ['payout_in_transit', 'platform'],
    ['platform_revenue', 'platform'],
  ] as const) {
    const exists = await db.execute(
      sql`select 1 from ledger_accounts where kind = ${kind} and owner_type is not distinct from ${ownerType} and owner_id is null`,
    )
    if (exists.length === 0) await db.insert(ledgerAccounts).values({ kind, ownerType })
  }
}
