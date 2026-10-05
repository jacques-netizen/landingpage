import type { tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { TEMPLATES, type CampaignType } from '@mde/campaigns/templates'
import type { BuilderValues } from './builder'

type Campaign = typeof tables.campaigns.$inferSelect

const money = (c: number | null) => (c === null ? '' : formatDollars(c))
const join = (v: string[] | null) => (v ?? []).join(', ')

/** A saved campaign as the builder form shows it. */
export function valuesFrom(c: Campaign): BuilderValues {
  return {
    title: c.title,
    type: c.type as CampaignType,
    clientId: c.clientId ?? '',
    coverImageUrl: c.coverImageUrl ?? '',
    briefMarkdown: c.briefMarkdown ?? '',
    assets: c.assets.map((a) => `${a.label} | ${a.url}`).join('\n'),
    examplePosts: c.examplePosts.join('\n'),
    platforms: c.platforms,
    budget: money(c.budgetCents),
    rate: money(c.rateCentsPer1000),
    capPerPost: money(c.capPerPostCents),
    capPerCreator: money(c.capPerCreatorCents),
    minViewsToEarn: c.minViewsToEarn ? String(c.minViewsToEarn) : '',
    minEngagement: c.minEngagementBps === null ? '' : (c.minEngagementBps / 100).toString(),
    maxPostsPerAccount: c.maxPostsPerAccount === null ? '' : String(c.maxPostsPerAccount),
    minFollowers: c.minFollowers === null ? '' : String(c.minFollowers),
    minAccountAgeDays: c.minAccountAgeDays === null ? '' : String(c.minAccountAgeDays),
    languages: join(c.languages),
    allowedRegions: join(c.allowedRegions),
    blockedRegions: join(c.blockedRegions),
    requiredHashtags: join(c.requiredHashtags),
    requireAdDisclosure: c.requireAdDisclosure,
    minDurationSeconds: c.minDurationSeconds === null ? '' : String(c.minDurationSeconds),
    keepLiveDays: String(c.keepLiveDays),
    visibility: c.visibility === 'private' ? 'private' : 'public',
    accessCode: c.accessCode ?? '',
    startAt: c.startAt ? c.startAt.toISOString() : null,
    endAt: c.endAt ? c.endAt.toISOString() : null,
    termsDraftMarkdown: c.termsDraftMarkdown ?? '',
    templateFields: c.templateFields,
  }
}

/** Empty builder values with a template's defaults applied. */
export function valuesForTemplate(type: CampaignType): BuilderValues {
  const t = TEMPLATES[type].defaults
  return {
    title: '',
    type,
    clientId: '',
    coverImageUrl: '',
    briefMarkdown: '',
    assets: '',
    examplePosts: '',
    platforms: [],
    budget: '',
    rate: '',
    capPerPost: '',
    capPerCreator: '',
    minViewsToEarn: '',
    minEngagement: '',
    maxPostsPerAccount: '',
    minFollowers: '',
    minAccountAgeDays: '',
    languages: '',
    allowedRegions: '',
    blockedRegions: '',
    requiredHashtags: t.requiredHashtags.join(', '),
    requireAdDisclosure: t.requireAdDisclosure,
    minDurationSeconds: t.minDurationSeconds === null ? '' : String(t.minDurationSeconds),
    keepLiveDays: String(t.keepLiveDays),
    visibility: 'public',
    accessCode: '',
    startAt: null,
    endAt: null,
    termsDraftMarkdown: '',
    templateFields: {},
  }
}
