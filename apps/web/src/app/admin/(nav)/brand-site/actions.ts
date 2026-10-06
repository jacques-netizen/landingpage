'use server'

import { db, getContentOverrides, updateContentOverrides } from '@mde/db'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'
import { BRAND_SITE_KEYS } from './keys'

export type BrandSiteState = { ok?: string; error?: string }

// Saves the brand site's videos, posters and booking link. Text and layout stay as designed.
export async function saveBrandSiteAction(_prev: BrandSiteState, form: FormData): Promise<BrandSiteState> {
  const viewer = await requireStaff('admin', '/admin/brand-site')
  const current = await getContentOverrides(db(), 'brands')
  const next = { ...current }
  for (const key of BRAND_SITE_KEYS) {
    const v = String(form.get(key) ?? '').trim()
    if (v && !/^(https?:\/\/|\/files\/|\/designed\/|mailto:)/.test(v))
      return { error: 'Each video, picture and link must be an upload or a web address starting with https://.' }
    if (v) next[key] = v
    else delete next[key]
  }
  await updateContentOverrides(db(), viewer.id, 'brands', next)
  revalidatePath('/brands')
  return { ok: 'Saved. The brand site shows the new videos now.' }
}
