import {
  settingKeys,
  settingSchemas,
  settingsDefaults,
  type SettingKey,
  type Settings,
} from '@mde/config'
import { eq } from 'drizzle-orm'
import type { Database } from './client'
import { writeAudit } from './audit'
import { settings } from './schema'

/** All settings, with defaults for any key that has no stored value. */
export async function getSettings(db: Pick<Database, 'select'>): Promise<Settings> {
  const rows = await db.select().from(settings)
  const stored = new Map(rows.map((r) => [r.key, r.value]))
  const out: Record<string, unknown> = {}
  for (const key of settingKeys)
    out[key] = stored.has(key) ? stored.get(key) : settingsDefaults[key]
  return out as Settings
}

export async function getSetting<K extends SettingKey>(
  db: Pick<Database, 'select'>,
  key: K,
): Promise<Settings[K]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  return (row ? row.value : settingsDefaults[key]) as Settings[K]
}

/** Validates, stores and audits one setting change in a single transaction. */
export async function updateSetting<K extends SettingKey>(
  db: Database,
  input: { key: K; value: unknown; actorId: string },
) {
  const schema = settingSchemas[input.key]
  if (!schema) throw new Error(`Unknown setting: ${String(input.key)}`)
  const value = schema.parse(input.value)
  await db.transaction(async (tx) => {
    const before = await getSetting(tx, input.key)
    await tx
      .insert(settings)
      .values({ key: input.key, value, updatedBy: input.actorId })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: input.actorId } })
    await writeAudit(tx, {
      actorId: input.actorId,
      action: 'settings.update',
      entity: 'settings',
      before: { key: input.key, value: before },
      after: { key: input.key, value },
    })
  })
}
