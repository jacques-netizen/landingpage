import { eq } from 'drizzle-orm'
import { writeAudit } from './audit'
import type { Db, DbOrTx } from './client'
import { settings } from './schema'

// Marketing content for the designed public pages lives in settings under `content.<page>`.
// The value is a map of text and video keys to staff-edited values. Keys that are not stored
// fall back to the approved copy from the mockups, so the layout never changes, only the words.
export const CONTENT_PAGES = ['home', 'brands', 'browse', 'wallet'] as const
export type ContentPage = (typeof CONTENT_PAGES)[number]
export type ContentOverrides = Record<string, string>

const keyFor = (page: ContentPage) => `content.${page}`

export async function getContentOverrides(d: DbOrTx, page: ContentPage): Promise<ContentOverrides> {
  const [row] = await d
    .select()
    .from(settings)
    .where(eq(settings.key, keyFor(page)))
  if (!row || typeof row.value !== 'object' || row.value === null) return {}
  const out: ContentOverrides = {}
  for (const [k, v] of Object.entries(row.value as Record<string, unknown>)) if (typeof v === 'string') out[k] = v
  return out
}

export async function updateContentOverrides(d: Db, actorId: string, page: ContentPage, next: ContentOverrides) {
  await d.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(settings)
      .where(eq(settings.key, keyFor(page)))
      .for('update')
    await tx
      .insert(settings)
      .values({ key: keyFor(page), value: next, updatedBy: actorId })
      .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedBy: actorId } })
    await writeAudit(tx, {
      actorId,
      action: 'content.update',
      entity: 'settings',
      entityId: keyFor(page),
      before: before?.value ?? {},
      after: next,
    })
  })
}
