import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { clients } from './clients'
import { id, timestamps, tz } from './_shared'
import { users } from './identity'

export const termsVersions = pgTable('terms_versions', {
  id: id(),
  campaignId: uuid('campaign_id').references((): AnyPgColumn => campaigns.id),
  bodyMarkdown: text('body_markdown').notNull(),
  effectiveAt: tz('effective_at').notNull(),
  ...timestamps,
})

export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    seriesId: uuid('series_id'),
    type: text('type').notNull(),
    title: text('title').notNull(),
    coverImageUrl: text('cover_image_url'),
    briefMarkdown: text('brief_markdown'),
    assets: jsonb('assets')
      .notNull()
      .default(sql`'[]'::jsonb`),
    examplePosts: jsonb('example_posts')
      .notNull()
      .default(sql`'[]'::jsonb`),
    platforms: text('platforms').array().notNull(),
    budgetCents: bigint('budget_cents', { mode: 'bigint' }).notNull(),
    rateCentsPer1000: integer('rate_cents_per_1000').notNull(),
    capPerPostCents: bigint('cap_per_post_cents', { mode: 'bigint' }),
    capPerCreatorCents: bigint('cap_per_creator_cents', { mode: 'bigint' }),
    minViewsToEarn: integer('min_views_to_earn').default(0),
    minEngagementBps: integer('min_engagement_bps'),
    maxPostsPerAccount: integer('max_posts_per_account'),
    minFollowers: integer('min_followers'),
    minAccountAgeDays: integer('min_account_age_days'),
    languages: text('languages').array(),
    allowedRegions: text('allowed_regions').array(),
    blockedRegions: text('blocked_regions').array(),
    requiredHashtags: text('required_hashtags').array(),
    requireAdDisclosure: boolean('require_ad_disclosure').default(true),
    minDurationSeconds: integer('min_duration_seconds'),
    keepLiveDays: integer('keep_live_days').default(30),
    visibility: text('visibility').notNull().default('public'),
    accessCode: text('access_code'),
    startAt: tz('start_at'),
    endAt: tz('end_at'),
    status: text('status').notNull().default('draft'),
    closedAt: tz('closed_at'),
    releaseAt: tz('release_at'),
    currentTermsVersionId: uuid('current_terms_version_id').references(
      (): AnyPgColumn => termsVersions.id,
    ),
    ...timestamps,
  },
  (t) => [
    check('campaigns_type_check', sql`${t.type} in ('clipping','logo','music','ugc')`),
    check('campaigns_budget_check', sql`${t.budgetCents} > 0`),
    check('campaigns_rate_check', sql`${t.rateCentsPer1000} > 0`),
    check('campaigns_visibility_check', sql`${t.visibility} in ('public','private')`),
    check(
      'campaigns_status_check',
      sql`${t.status} in ('draft','awaiting_funding','live','closing','closed','cancelled')`,
    ),
  ],
)

export const campaignMembers = pgTable(
  'campaign_members',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    joinedAt: tz('joined_at').notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.creatorId] })],
)
