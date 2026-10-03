import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { linkedAccounts } from './accounts'
import { campaigns, termsVersions } from './campaigns'
import { id, timestamps, tz } from './_shared'
import { users } from './identity'

export const submissionStates = [
  'checking',
  'rejected_auto',
  'needs_review',
  'needs_info',
  'approved',
  'earning',
  'flagged',
  'final',
  'paid_out',
  'rejected',
  'removed',
  'appealed',
] as const

export const submissions = pgTable(
  'submissions',
  {
    id: id(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    linkedAccountId: uuid('linked_account_id').references(() => linkedAccounts.id),
    platform: text('platform').notNull(),
    postUrl: text('post_url').notNull(),
    platformPostId: text('platform_post_id').notNull(),
    state: text('state').notNull().default('checking'),
    reasonCode: text('reason_code'),
    reasonNote: text('reason_note'),
    /** Locked at submit time. */
    termsVersionId: uuid('terms_version_id')
      .notNull()
      .references(() => termsVersions.id),
    rateCentsPer1000Locked: integer('rate_cents_per_1000_locked').notNull(),
    publishedAt: tz('published_at'),
    submittedAt: tz('submitted_at').notNull(),
    /** Views at submission. Never counted. */
    baselineViews: bigint('baseline_views', { mode: 'number' }).notNull().default(0),
    latestViews: bigint('latest_views', { mode: 'number' }).notNull().default(0),
    countedViews: bigint('counted_views', { mode: 'number' }).notNull().default(0),
    /** What has been moved into pending for this post, in cents. */
    earnedCents: bigint('earned_cents', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    /** Perceptual hash for duplicate checks. */
    mediaHash: text('media_hash'),
    ...timestamps,
  },
  (t) => [
    unique('submissions_post_unique').on(t.campaignId, t.platform, t.platformPostId),
    index('submissions_creator_idx').on(t.creatorId),
    index('submissions_state_idx').on(t.state),
    check(
      'submissions_state_check',
      sql`${t.state} in ('checking','rejected_auto','needs_review','needs_info','approved','earning','flagged','final','paid_out','rejected','removed','appealed')`,
    ),
  ],
)

export const viewSnapshots = pgTable(
  'view_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    takenAt: tz('taken_at').notNull(),
    views: bigint('views', { mode: 'number' }),
    likes: bigint('likes', { mode: 'number' }),
    comments: bigint('comments', { mode: 'number' }),
    shares: bigint('shares', { mode: 'number' }),
    saves: bigint('saves', { mode: 'number' }),
    isPublic: boolean('is_public'),
    /** 'youtube_api', 'instagram_api', 'tiktok_api' or 'provider:<name>'. */
    source: text('source'),
    raw: jsonb('raw'),
    ...timestamps,
  },
  (t) => [index('view_snapshots_submission_taken_idx').on(t.submissionId, sql`${t.takenAt} desc`)],
)

export const reviewDecisions = pgTable(
  'review_decisions',
  {
    id: id(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    /** Null for automatic checks. */
    reviewerId: uuid('reviewer_id').references(() => users.id),
    outcome: text('outcome').notNull(),
    reasonCode: text('reason_code'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    check(
      'review_decisions_outcome_check',
      sql`${t.outcome} in ('approve','reject','request_info','reverse','remove')`,
    ),
  ],
)

export const fraudFlags = pgTable(
  'fraud_flags',
  {
    id: id(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    kind: text('kind').notNull(),
    detail: jsonb('detail'),
    status: text('status').notNull().default('open'),
    resolvedAt: tz('resolved_at'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolutionNote: text('resolution_note'),
    ...timestamps,
  },
  (t) => [check('fraud_flags_status_check', sql`${t.status} in ('open','cleared','confirmed')`)],
)

export const appeals = pgTable(
  'appeals',
  {
    id: id(),
    /** One appeal per submission. */
    submissionId: uuid('submission_id')
      .notNull()
      .unique()
      .references(() => submissions.id),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    message: text('message').notNull(),
    status: text('status').notNull().default('open'),
    reply: text('reply'),
    reviewerId: uuid('reviewer_id').references(() => users.id),
    dueAt: tz('due_at').notNull(),
    resolvedAt: tz('resolved_at'),
    ...timestamps,
  },
  (t) => [check('appeals_status_check', sql`${t.status} in ('open','upheld','overturned')`)],
)

export const warnings = pgTable('warnings', {
  id: id(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id),
  reasonCode: text('reason_code'),
  note: text('note'),
  expiresAt: tz('expires_at'),
  createdBy: uuid('created_by').references(() => users.id),
  ...timestamps,
})
