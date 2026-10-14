'use server'

import { revalidatePath } from 'next/cache'
import { DEMOS } from '@/demo'
import { importDemoCampaign } from '@/server/demo-import'
import { requireStaff } from '@/server/guard'

export type DemoActionState = { error?: string; ok?: string }

/** Make one demo campaign from its clip file. Admin only; running it again changes nothing. */
export async function createDemoAction(slug: string): Promise<DemoActionState> {
  const viewer = await requireStaff('admin', '/admin/demo')
  const spec = DEMOS.find((d) => d.slug === slug)
  if (!spec) return { error: 'No such demo.' }
  try {
    const r = await importDemoCampaign(viewer.id, spec)
    revalidatePath('/admin/demo')
    return {
      ok: r.created
        ? `Made ${spec.title} with ${r.posts.toLocaleString('en-US')} clips and ${r.views.toLocaleString('en-US')} views.`
        : `${spec.title} already exists.`,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
