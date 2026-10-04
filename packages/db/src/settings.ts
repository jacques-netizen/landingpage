import { SETTINGS_DEFAULTS, settingsSchema, type SettingKey, type Settings } from '@mde/config'
import { eq, inArray } from 'drizzle-orm'
import { writeAudit } from './audit'
import type { Db, DbOrTx } from './client'
import { settings } from './schema'

// Read every setting. Stored values override the defaults key by key.
export async function getSettings(d: DbOrTx): Promise<Settings> {
  const rows = await d
    .select()
    .from(settings)
    .where(inArray(settings.key, Object.keys(SETTINGS_DEFAULTS)))
  const merged: Record<string, unknown> = { ...SETTINGS_DEFAULTS }
  for (const row of rows) merged[row.key] = row.value
  return settingsSchema.parse(merged)
}

export async function getSetting<K extends SettingKey>(d: DbOrTx, key: K): Promise<Settings[K]> {
  const [row] = await d.select().from(settings).where(eq(settings.key, key))
  if (!row) return SETTINGS_DEFAULTS[key]
  return settingsSchema.shape[key].parse(row.value) as Settings[K]
}

// Change one setting. Validated, and audited in the same transaction (03_SYSTEMS.md section 15).
export async function updateSetting<K extends SettingKey>(d: Db, actorId: string, key: K, value: Settings[K]) {
  const parsed = settingsSchema.shape[key].parse(value)
  await d.transaction(async (tx) => {
    const [before] = await tx.select().from(settings).where(eq(settings.key, key)).for('update')
    await tx
      .insert(settings)
      .values({ key, value: parsed, updatedBy: actorId })
      .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedBy: actorId } })
    await writeAudit(tx, {
      actorId,
      action: 'settings.update',
      entity: 'settings',
      entityId: key,
      before: before ? before.value : SETTINGS_DEFAULTS[key],
      after: parsed,
    })
  })
}

// Write every default that is not stored yet. Never overwrites a stored value.
export async function seedSettingsDefaults(d: DbOrTx) {
  const values = Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => ({ key, value }))
  await d.insert(settings).values(values).onConflictDoNothing()
}
