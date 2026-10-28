import { createHash, randomBytes } from 'node:crypto'
import { tables, writeAudit, type DbOrTx } from '@mde/db'
import { and, desc, eq, isNull } from 'drizzle-orm'

// Partner API keys (owner decision, 2026-10-28): made by staff for partners they approve, shown once,
// stored only as a SHA-256 hash. "mde_live_" keys see live campaigns, "mde_test_" keys demo campaigns.

export type PartnerKey = typeof tables.partnerKeys.$inferSelect
export type KeyMode = 'live' | 'sandbox'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const random = (n: number) => {
  const bytes = randomBytes(n)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}
export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

export async function createPartnerKey(
  db: DbOrTx,
  actorId: string,
  input: { partner: string; mode: KeyMode; clientIds: string[] | null },
): Promise<{ key: string; row: PartnerKey }> {
  const partner = input.partner.trim().slice(0, 80)
  if (!partner) throw new Error('Give the partner a name.')
  const key = `mde_${input.mode === 'live' ? 'live' : 'test'}_${random(32)}`
  const [row] = await db
    .insert(tables.partnerKeys)
    .values({
      partner,
      mode: input.mode,
      prefix: key.slice(0, 13),
      keyHash: hashKey(key),
      clientIds: input.clientIds?.length ? input.clientIds : null,
      createdBy: actorId,
    })
    .returning()
  await writeAudit(db, {
    actorId,
    action: 'partner_key.create',
    entity: 'partner_key',
    entityId: row!.id,
    after: { partner, mode: input.mode, prefix: row!.prefix, clientIds: row!.clientIds },
  })
  return { key, row: row! }
}

export async function revokePartnerKey(db: DbOrTx, actorId: string, id: string) {
  const [row] = await db
    .update(tables.partnerKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(tables.partnerKeys.id, id), isNull(tables.partnerKeys.revokedAt)))
    .returning()
  if (!row) return false
  await db
    .update(tables.partnerWebhooks)
    .set({ disabledAt: new Date() })
    .where(and(eq(tables.partnerWebhooks.keyId, id), isNull(tables.partnerWebhooks.disabledAt)))
  await writeAudit(db, {
    actorId,
    action: 'partner_key.revoke',
    entity: 'partner_key',
    entityId: id,
    after: { partner: row.partner, prefix: row.prefix },
  })
  return true
}

/** The key behind an Authorization header, or null when it is missing, unknown or revoked. */
export async function keyFromHeader(db: DbOrTx, header: string | null): Promise<PartnerKey | null> {
  const m = header?.match(/^Bearer\s+(mde_(?:live|test)_[A-Za-z0-9]{32})$/)
  if (!m) return null
  const [row] = await db
    .select()
    .from(tables.partnerKeys)
    .where(and(eq(tables.partnerKeys.keyHash, hashKey(m[1]!)), isNull(tables.partnerKeys.revokedAt)))
  if (!row) return null
  // At most once a minute, so a busy key does not write on every request.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000)
    await db.update(tables.partnerKeys).set({ lastUsedAt: new Date() }).where(eq(tables.partnerKeys.id, row.id))
  return row
}

export async function listPartnerKeys(db: DbOrTx) {
  return db.select().from(tables.partnerKeys).orderBy(desc(tables.partnerKeys.createdAt))
}
