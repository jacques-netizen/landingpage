'use server'

import { revalidatePath } from 'next/cache'
import { DEMOS } from '@/demo'
import { addDemoClips, demoStatus, finishDemo, startDemo, type DemoStatus } from '@/server/demo-import'
import { canSearch, searchStep, type SearchPlatform } from '@/server/demo-search'
import { requireStaff } from '@/server/guard'

// The demo builder's steps (owner request, 2026-10-14). Admin only. Each step is short so no request
// times out; the page calls them in order and shows progress.

type Fail = { error: string }
const fail = (e: unknown): Fail => ({ error: e instanceof Error ? e.message : String(e) })
const specOf = (slug: string) => {
  const spec = DEMOS.find((d) => d.slug === slug)
  if (!spec) throw new Error('No such demo.')
  return spec
}
async function admin() {
  return requireStaff('admin', '/admin/demo')
}

export async function demoStartAction(slug: string, replace: boolean): Promise<{ id: string } | Fail> {
  const viewer = await admin()
  try {
    return { id: await startDemo(viewer.id, specOf(slug), { replace }) }
  } catch (e) {
    return fail(e)
  }
}

/** One page of one platform's search, its clips added within that platform's share of the budget. */
export async function demoSearchAction(
  slug: string,
  platform: SearchPlatform,
  query: string,
  cursor: string | null,
  topUp = false,
): Promise<
  { added: number; credits: number; creditsRemaining: number | null; next: string | null; skipped?: true } | Fail
> {
  const viewer = await admin()
  if (!canSearch()) return { added: 0, credits: 0, creditsRemaining: null, next: null, skipped: true }
  try {
    const spec = specOf(slug)
    const step = await searchStep({
      platform,
      query,
      cursor,
      mustMention: spec.search.mustMention,
      minViews: spec.search.minViews,
      window: { start: spec.startAt, end: spec.endAt },
    })
    const r = step.clips.length
      ? await addDemoClips(
          viewer.id,
          spec,
          step.clips,
          // The top-up round fills what the budget has left, clips of any size.
          topUp ? {} : { platformShare: spec.search.shares[platform] ?? 0, bigClips: spec.search.bigClips },
        )
      : { added: 0 }
    return { added: r.added, credits: step.credits, creditsRemaining: step.creditsRemaining, next: step.next }
  } catch (e) {
    return fail(e)
  }
}

/** The next batch of YouTube clips from the file, while the budget has room. */
export async function demoYoutubeAction(
  slug: string,
  offset: number,
): Promise<{ added: number; done: boolean } | Fail> {
  const viewer = await admin()
  try {
    const spec = specOf(slug)
    const batch = spec.clips.slice(offset, offset + 80)
    const r = await addDemoClips(viewer.id, spec, batch)
    return { added: r.added, done: offset + 80 >= spec.clips.length || r.roomCents < 100 }
  } catch (e) {
    return fail(e)
  }
}

export async function demoFinishAction(slug: string): Promise<{ status: DemoStatus | null } | Fail> {
  const viewer = await admin()
  try {
    const status = await finishDemo(viewer.id, specOf(slug))
    revalidatePath('/admin/demo')
    return { status }
  } catch (e) {
    return fail(e)
  }
}

export async function demoStatusAction(slug: string): Promise<DemoStatus | null> {
  await admin()
  return demoStatus(specOf(slug))
}
