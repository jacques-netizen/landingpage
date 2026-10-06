// The campaign builder form, validated on the server. Every field from 01_PRODUCT.md section 6.1.
// Money arrives as dollars typed by staff and is turned into whole cents with string maths.
import { parseDollarsToCents } from '@mde/money/dollars'
import { z } from 'zod'
import { TEMPLATES, type CampaignType } from './templates'

const text = (max = 200) => z.string().trim().max(max)
const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
const list = z.string().transform((v) =>
  v
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean),
)
const optionalList = list.transform((v) => (v.length ? v : null))
const optionalInt = (label: string, max = 1_000_000_000) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null
      if (!/^\d+$/.test(v.replace(/,/g, ''))) {
        ctx.addIssue({ code: 'custom', message: `${label} must be a whole number.` })
        return z.NEVER
      }
      const n = Number(v.replace(/,/g, ''))
      if (n > max) {
        ctx.addIssue({ code: 'custom', message: `${label} is too large.` })
        return z.NEVER
      }
      return n
    })
const dollars = (label: string, required: boolean) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') {
        if (required) ctx.addIssue({ code: 'custom', message: `Enter the ${label.toLowerCase()} in dollars.` })
        return required ? z.NEVER : null
      }
      const r = parseDollarsToCents(v)
      if (!r.ok) {
        ctx.addIssue({ code: 'custom', message: r.message })
        return z.NEVER
      }
      return r.cents
    })
const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid date and time.' })
      return z.NEVER
    }
    return d
  })
const percentToBps = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null
      const m = /^(\d{1,3})(?:\.(\d{1,2}))?%?$/.exec(v)
      if (!m) {
        ctx.addIssue({ code: 'custom', message: `${label} must be a percent, like 1.5.` })
        return z.NEVER
      }
      const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
      if (bps > 10_000) {
        ctx.addIssue({ code: 'custom', message: `${label} cannot be more than 100%.` })
        return z.NEVER
      }
      return bps
    })

export const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x'] as const

export const campaignFormSchema = z
  .object({
    title: text().min(1, 'Give the campaign a title.'),
    type: z.enum(['clipping', 'logo', 'music', 'ugc']),
    clientId: z.string().uuid('Choose a client.'),
    coverImageUrl: optionalText(500),
    briefMarkdown: optionalText(20_000),
    assets: z.string().transform((v, ctx) => {
      // One asset per line: "Label | https://link"
      const out: { label: string; url: string }[] = []
      for (const line of v
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)) {
        const [label, url] = line.split('|').map((x) => x.trim())
        if (!label || !url || !/^(https?:\/\/|\/files\/)/.test(url)) {
          ctx.addIssue({ code: 'custom', message: `Write each asset as "Label | https://link". Check: ${line}` })
          return z.NEVER
        }
        out.push({ label, url })
      }
      return out
    }),
    examplePosts: list,
    platforms: z.array(z.enum(PLATFORMS)).min(1, 'Choose at least one platform.'),
    budgetCents: dollars('Budget', true),
    rateCentsPer1000: dollars('Rate', true),
    capPerPostCents: dollars('Cap per post', false),
    capPerCreatorCents: dollars('Cap per creator', false),
    minViewsToEarn: optionalInt('Minimum views'),
    minEngagementBps: percentToBps('Minimum engagement'),
    maxPostsPerAccount: optionalInt('Posts per account', 1000),
    minFollowers: optionalInt('Minimum followers'),
    minAccountAgeDays: optionalInt('Minimum account age', 100_000),
    languages: optionalList,
    allowedRegions: optionalList,
    blockedRegions: optionalList,
    requiredHashtags: optionalList,
    requireAdDisclosure: z.boolean(),
    minDurationSeconds: optionalInt('Minimum duration', 100_000),
    keepLiveDays: optionalInt('Keep live days', 3650),
    visibility: z.enum(['public', 'private']),
    accessCode: optionalText(64),
    startAt: optionalDate,
    endAt: optionalDate,
    termsDraftMarkdown: optionalText(50_000),
    templateFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  })
  .superRefine((v, ctx) => {
    if (v.budgetCents !== null && v.budgetCents <= 0)
      ctx.addIssue({ code: 'custom', path: ['budgetCents'], message: 'The budget must be more than $0.00.' })
    if (v.rateCentsPer1000 !== null && v.rateCentsPer1000 <= 0)
      ctx.addIssue({
        code: 'custom',
        path: ['rateCentsPer1000'],
        message: 'The rate must be more than $0.00 per 1,000 views.',
      })
    if (v.visibility === 'private' && !v.accessCode)
      ctx.addIssue({ code: 'custom', path: ['accessCode'], message: 'Private campaigns need an access code.' })
    if (v.startAt && v.endAt && v.endAt <= v.startAt)
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'The end must be after the start.' })
    const allowed = new Set(TEMPLATES[v.type as CampaignType].fields.map((f) => f.key))
    for (const k of Object.keys(v.templateFields))
      if (!allowed.has(k)) ctx.addIssue({ code: 'custom', path: ['templateFields'], message: `Unknown field ${k}.` })
  })

export type CampaignFormInput = z.input<typeof campaignFormSchema>
export type CampaignForm = z.output<typeof campaignFormSchema>
