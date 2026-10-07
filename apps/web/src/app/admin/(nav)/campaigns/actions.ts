'use server'

import {
  campaignFormSchema,
  CampaignError,
  cancelCampaign,
  deleteCampaign,
  closeCampaign,
  copyCampaign,
  createClient,
  createDraft,
  fundCampaign,
  goLive,
  publishCampaign,
  TEMPLATES,
  updateCampaign,
  type CampaignType,
} from '@mde/campaigns'
import { db } from '@mde/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireStaff } from '@/server/guard'

export type BuilderState = { error?: string; ok?: string; fields?: Record<string, string> }

/** Read the builder form into the shape the schema expects. */
function readForm(form: FormData) {
  const type = String(form.get('type') ?? 'clipping') as CampaignType
  const templateFields: Record<string, string | number | boolean> = {}
  for (const f of TEMPLATES[type]?.fields ?? []) {
    const raw = form.get(`tf.${f.key}`)
    if (f.kind === 'boolean') templateFields[f.key] = raw === 'on'
    else if (typeof raw === 'string' && raw.trim() !== '')
      templateFields[f.key] = f.kind === 'number' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw.trim()
  }
  const s = (k: string) => String(form.get(k) ?? '')
  return {
    title: s('title'),
    type,
    clientId: s('clientId'),
    coverImageUrl: s('coverImageUrl'),
    briefMarkdown: s('briefMarkdown'),
    assets: s('assets'),
    examplePosts: s('examplePosts'),
    platforms: form.getAll('platforms').map(String),
    budgetCents: s('budget'),
    rateCentsPer1000: s('rate'),
    capPerPostCents: s('capPerPost'),
    capPerCreatorCents: s('capPerCreator'),
    minViewsToEarn: s('minViewsToEarn'),
    minEngagementBps: s('minEngagement'),
    maxPostsPerAccount: s('maxPostsPerAccount'),
    minFollowers: s('minFollowers'),
    minAccountAgeDays: s('minAccountAgeDays'),
    languages: s('languages'),
    allowedRegions: s('allowedRegions'),
    blockedRegions: s('blockedRegions'),
    requiredHashtags: s('requiredHashtags'),
    requireAdDisclosure: false,
    minDurationSeconds: s('minDurationSeconds'),
    keepLiveDays: s('keepLiveDays'),
    visibility: s('visibility') === 'private' ? 'private' : 'public',
    accessCode: s('accessCode'),
    startAt: s('startAt'),
    endAt: s('endAt'),
    termsDraftMarkdown: s('termsDraftMarkdown'),
    templateFields,
  }
}

// Form field names differ from schema keys for the money fields.
const FIELD_NAMES: Record<string, string> = {
  budgetCents: 'budget',
  rateCentsPer1000: 'rate',
  capPerPostCents: 'capPerPost',
  capPerCreatorCents: 'capPerCreator',
  minEngagementBps: 'minEngagement',
}

export async function saveCampaignAction(
  id: string | null,
  _prev: BuilderState,
  form: FormData,
): Promise<BuilderState> {
  const viewer = await requireStaff('money', '/admin/campaigns')
  const parsed = campaignFormSchema.safeParse(readForm(form))
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const i of parsed.error.issues) {
      const key = String(i.path[0] ?? 'form')
      fields[FIELD_NAMES[key] ?? key] ??= i.message
    }
    return { fields, error: 'Some fields need attention. They are marked below.' }
  }
  try {
    if (!id) {
      const c = await createDraft(db(), viewer.id, parsed.data)
      redirect(`/admin/campaigns/${c.id}?saved=1`)
    }
    await updateCampaign(db(), viewer.id, id, parsed.data)
    revalidatePath('/campaigns')
  } catch (e) {
    if (e instanceof CampaignError) return { error: e.message }
    throw e
  }
  revalidatePath(`/admin/campaigns/${id}`)
  return { ok: 'Saved.' }
}

/** Publish, fund, copy, close or cancel. Each is audited inside the campaigns package. */
export async function campaignAction(id: string, _prev: BuilderState, form: FormData): Promise<BuilderState> {
  const viewer = await requireStaff('money', `/admin/campaigns/${id}`)
  const what = String(form.get('action') ?? '')
  try {
    if (what === 'golive') {
      await goLive(db(), viewer.id, id, { reference: String(form.get('reference') ?? '') })
      revalidatePath(`/admin/campaigns/${id}`)
      revalidatePath('/campaigns')
      return { ok: 'Live. Creators can see it and join now.' }
    }
    if (what === 'publish') {
      const status = await publishCampaign(db(), viewer.id, id)
      revalidatePath(`/admin/campaigns/${id}`)
      return {
        ok: status === 'live' ? 'Published. The campaign is live.' : 'Published. It goes live as soon as it is funded.',
      }
    }
    if (what === 'fund') {
      const status = await fundCampaign(db(), viewer.id, id)
      revalidatePath(`/admin/campaigns/${id}`)
      return { ok: status === 'live' ? 'Funded. The campaign is live.' : 'Funded. Publish it to go live.' }
    }
    if (what === 'copy') {
      const copy = await copyCampaign(db(), viewer.id, id)
      redirect(`/admin/campaigns/${copy.id}?copied=1`)
    }
    if (what === 'close') {
      await db().transaction((tx) => closeCampaign(tx, viewer.id, id))
      revalidatePath(`/admin/campaigns/${id}`)
      return { ok: 'Closed. Earnings are released after the review window.' }
    }
    if (what === 'delete') {
      // Deleting is for admins only, on top of the money access this action already needs.
      await requireStaff('admin', `/admin/campaigns/${id}`)
      const how = await deleteCampaign(db(), viewer.id, id)
      revalidatePath('/admin/campaigns')
      revalidatePath('/campaigns')
      redirect(`/admin/campaigns?deleted=${how}`)
    }
    if (what === 'cancel') {
      await cancelCampaign(db(), viewer.id, id)
      revalidatePath(`/admin/campaigns/${id}`)
      return { ok: 'Cancelled.' }
    }
  } catch (e) {
    if (e instanceof CampaignError) return { error: e.message }
    throw e
  }
  return { error: 'Unknown action.' }
}

/** Add a client from inside the campaign builder: just a name and the service fee in percent. */
export async function quickClientAction(input: {
  name: string
  feePercent: string
}): Promise<{ error?: string; client?: { id: string; name: string } }> {
  const viewer = await requireStaff('money', '/admin/campaigns')
  const name = input.name.trim()
  if (!name) return { error: 'Enter the client name.' }
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?\s*%?$/.exec(input.feePercent.trim() || '0')
  const bps = m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : NaN
  if (!m || bps > 10_000) return { error: 'Enter the fee as a percent, like 10.' }
  const c = await createClient(db(), viewer.id, {
    name: name.slice(0, 200),
    contactName: null,
    contactEmail: null,
    serviceFeeBps: bps,
    notes: null,
  })
  return { client: { id: c.id, name: c.name } }
}
