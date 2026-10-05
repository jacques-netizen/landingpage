// Database schema. Mirrors 02_DATA_AND_MONEY.md section 2, plus the columns Auth.js needs.
// Money is bigint whole cents (columns end in _cents). Rates are integer cents per 1,000 views.
// Percentages are integer basis points (_bps). No floats anywhere.
import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

const citext = customType<{ data: string }>({ dataType: () => 'citext' })
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const cents = (name: string) => bigint(name, { mode: 'number' })
const id = () => uuid('id').primaryKey().defaultRandom()
const timestamps = {
  createdAt: tz('created_at').notNull().defaultNow(),
  updatedAt: tz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(',')})`)

// ---------- Identity ----------

export const USER_STATUSES = ['active', 'suspended', 'closed'] as const

export const users = pgTable(
  'users',
  {
    id: id(),
    email: citext('email').notNull().unique(),
    // Auth.js reads these by property name: name, emailVerified, image.
    name: text('display_name'),
    image: text('avatar_url'),
    emailVerified: tz('email_verified_at'),
    isPrivateProfile: boolean('is_private_profile').notNull().default(false),
    isAdultConfirmed: boolean('is_adult_confirmed').notNull().default(false),
    adultConfirmedAt: tz('adult_confirmed_at'),
    termsAcceptedAt: tz('terms_accepted_at'),
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  () => [check('users_status_check', inList('status', USER_STATUSES))],
)

export const STAFF_ROLE_VALUES = ['reviewer', 'finance', 'admin'] as const

export const staffRoles = pgTable(
  'staff_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.role] }),
    check('staff_roles_role_check', inList('role', STAFF_ROLE_VALUES)),
  ],
)

// One row per way of signing in. Doubles as the Auth.js accounts table.
export const AUTH_PROVIDERS = ['email', 'google', 'discord'] as const

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_user_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
    ...timestamps,
  },
  (t) => [
    unique('auth_identities_provider_user').on(t.provider, t.providerAccountId),
    check('auth_identities_provider_check', inList('provider', AUTH_PROVIDERS)),
  ],
)

// Auth.js database sessions. Expire after 30 days idle (03_SYSTEMS.md section 1).
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: tz('expires').notNull(),
  ...timestamps,
})

// Auth.js magic link tokens.
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: tz('expires').notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
)

export const PAYOUT_STATUSES = ['none', 'pending', 'verified', 'restricted'] as const

export const creatorProfiles = pgTable(
  'creator_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    payoutStatus: text('payout_status').notNull().default('none'),
    payoutProvider: text('payout_provider'),
    payoutProviderRef: text('payout_provider_ref'),
    taxStatus: text('tax_status').notNull().default('not_collected'),
    strikesActive: integer('strikes_active').notNull().default(0),
    staffNotes: text('staff_notes'),
    ...timestamps,
  },
  () => [check('creator_profiles_payout_status_check', inList('payout_status', PAYOUT_STATUSES))],
)

// ---------- Accounts and clients ----------

export const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x'] as const
export const LINK_METHODS = ['oauth', 'bio_code'] as const
export const LINKED_ACCOUNT_STATUSES = ['pending', 'verified', 'failed', 'removed'] as const

export const linkedAccounts = pgTable(
  'linked_accounts',
  {
    id: id(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    platform: text('platform').notNull(),
    platformUserId: text('platform_user_id'),
    handle: text('handle').notNull(),
    linkMethod: text('link_method').notNull(),
    verifiedAt: tz('verified_at'),
    verificationCode: text('verification_code'),
    verificationExpiresAt: tz('verification_expires_at'),
    followers: integer('followers'),
    accountCreatedAt: tz('account_created_at'),
    tokenCiphertext: bytea('token_ciphertext'),
    status: text('status').notNull().default('pending'),
    lastCheckedAt: tz('last_checked_at'),
    ...timestamps,
  },
  (t) => [
    // A platform account belongs to one creator at a time. A removed link frees it.
    uniqueIndex('linked_accounts_platform_user')
      .on(t.platform, t.platformUserId)
      .where(sql`${t.status} <> 'removed'`),
    check('linked_accounts_platform_check', inList('platform', PLATFORMS)),
    check('linked_accounts_link_method_check', inList('link_method', LINK_METHODS)),
    check('linked_accounts_status_check', inList('status', LINKED_ACCOUNT_STATUSES)),
  ],
)

export const clients = pgTable('clients', {
  id: id(),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  serviceFeeBps: integer('service_fee_bps').notNull().default(0),
  notes: text('notes'),
  ...timestamps,
})

// ---------- Campaigns ----------

export const CAMPAIGN_TYPES = ['clipping', 'logo', 'music', 'ugc'] as const
export const CAMPAIGN_VISIBILITIES = ['public', 'private'] as const
export const CAMPAIGN_STATUSES = ['draft', 'awaiting_funding', 'live', 'closing', 'closed', 'cancelled'] as const

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
    clientId: uuid('client_id').references(() => clients.id),
    seriesId: uuid('series_id'),
    type: text('type').notNull(),
    title: text('title').notNull(),
    coverImageUrl: text('cover_image_url'),
    briefMarkdown: text('brief_markdown'),
    assets: jsonb('assets').$type<{ label: string; url: string }[]>().notNull().default([]),
    examplePosts: jsonb('example_posts').$type<string[]>().notNull().default([]),
    platforms: text('platforms').array().notNull(),
    budgetCents: cents('budget_cents').notNull(),
    rateCentsPer1000: integer('rate_cents_per_1000').notNull(),
    capPerPostCents: cents('cap_per_post_cents'),
    capPerCreatorCents: cents('cap_per_creator_cents'),
    minViewsToEarn: integer('min_views_to_earn').notNull().default(0),
    minEngagementBps: integer('min_engagement_bps'),
    maxPostsPerAccount: integer('max_posts_per_account'),
    minFollowers: integer('min_followers'),
    minAccountAgeDays: integer('min_account_age_days'),
    languages: text('languages').array(),
    allowedRegions: text('allowed_regions').array(),
    blockedRegions: text('blocked_regions').array(),
    requiredHashtags: text('required_hashtags').array(),
    requireAdDisclosure: boolean('require_ad_disclosure').notNull().default(true),
    minDurationSeconds: integer('min_duration_seconds'),
    keepLiveDays: integer('keep_live_days').notNull().default(30),
    visibility: text('visibility').notNull().default('public'),
    accessCode: text('access_code'),
    startAt: tz('start_at'),
    endAt: tz('end_at'),
    status: text('status').notNull().default('draft'),
    closedAt: tz('closed_at'),
    releaseAt: tz('release_at'),
    currentTermsVersionId: uuid('current_terms_version_id').references((): AnyPgColumn => termsVersions.id),
    // Template-specific rules (01_PRODUCT.md section 6.2), e.g. logo file, safe zone, audio link.
    templateFields: jsonb('template_fields').$type<Record<string, string | number | boolean>>().notNull().default({}),
    // Rules text being edited before it is saved as a terms version.
    termsDraftMarkdown: text('terms_draft_markdown'),
    ...timestamps,
  },
  () => [
    check('campaigns_type_check', inList('type', CAMPAIGN_TYPES)),
    check('campaigns_visibility_check', inList('visibility', CAMPAIGN_VISIBILITIES)),
    check('campaigns_status_check', inList('status', CAMPAIGN_STATUSES)),
    check('campaigns_budget_positive', sql`budget_cents > 0`),
    check('campaigns_rate_positive', sql`rate_cents_per_1000 > 0`),
  ],
)

export const clientReportLinks = pgTable('client_report_links', {
  id: id(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  tokenHash: text('token_hash').notNull().unique(),
  revokedAt: tz('revoked_at'),
  ...timestamps,
})

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

// ---------- Submissions and views ----------

export const SUBMISSION_STATES = [
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
    termsVersionId: uuid('terms_version_id')
      .notNull()
      .references(() => termsVersions.id),
    rateCentsPer1000Locked: integer('rate_cents_per_1000_locked').notNull(),
    publishedAt: tz('published_at'),
    submittedAt: tz('submitted_at').notNull(),
    baselineViews: bigint('baseline_views', { mode: 'number' }).notNull().default(0),
    latestViews: bigint('latest_views', { mode: 'number' }).notNull().default(0),
    countedViews: bigint('counted_views', { mode: 'number' }).notNull().default(0),
    earnedCents: cents('earned_cents').notNull().default(0),
    mediaHash: text('media_hash'),
    // The automatic check results the creator saw, in order (03_SYSTEMS.md section 4).
    checkResults: jsonb('check_results'),
    creatorNote: text('creator_note'),
    // When the next view check is due (03_SYSTEMS.md 3.2). Null once tracking has ended.
    nextCheckAt: tz('next_check_at'),
    // First check that could not see the post, for the grace period in 03_SYSTEMS.md 3.4.
    missingSince: tz('missing_since'),
    ...timestamps,
  },
  (t) => [
    unique('submissions_campaign_post').on(t.campaignId, t.platform, t.platformPostId),
    index('submissions_next_check').on(t.nextCheckAt),
    check('submissions_state_check', inList('state', SUBMISSION_STATES)),
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
    source: text('source'),
    raw: jsonb('raw'),
    ...timestamps,
  },
  (t) => [index('view_snapshots_submission_taken').on(t.submissionId, t.takenAt.desc())],
)

export const REVIEW_OUTCOMES = ['approve', 'reject', 'request_info', 'reverse', 'remove'] as const

export const reviewDecisions = pgTable(
  'review_decisions',
  {
    id: id(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    reviewerId: uuid('reviewer_id').references(() => users.id),
    outcome: text('outcome').notNull(),
    reasonCode: text('reason_code'),
    note: text('note'),
    ...timestamps,
  },
  () => [check('review_decisions_outcome_check', inList('outcome', REVIEW_OUTCOMES))],
)

export const FLAG_STATUSES = ['open', 'cleared', 'confirmed'] as const

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
    ...timestamps,
  },
  () => [check('fraud_flags_status_check', inList('status', FLAG_STATUSES))],
)

export const APPEAL_STATUSES = ['open', 'upheld', 'overturned'] as const

export const appeals = pgTable(
  'appeals',
  {
    id: id(),
    submissionId: uuid('submission_id')
      .notNull()
      .unique()
      .references(() => submissions.id),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    message: text('message').notNull(),
    status: text('status').notNull().default('open'),
    // The submission's state when the appeal opened, restored if the decision is upheld.
    previousState: text('previous_state'),
    links: text('links').array(),
    reply: text('reply'),
    reviewerId: uuid('reviewer_id').references(() => users.id),
    dueAt: tz('due_at').notNull(),
    resolvedAt: tz('resolved_at'),
    ...timestamps,
  },
  () => [check('appeals_status_check', inList('status', APPEAL_STATUSES))],
)

export const warnings = pgTable('warnings', {
  id: id(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id),
  reasonCode: text('reason_code'),
  note: text('note'),
  // The post the warning came from, so an overturned appeal can clear it.
  submissionId: uuid('submission_id').references(() => submissions.id),
  expiresAt: tz('expires_at'),
  createdBy: uuid('created_by').references(() => users.id),
  ...timestamps,
})

// ---------- Money ----------

export const LEDGER_ACCOUNT_KINDS = [
  'client_funds_holding',
  'campaign_budget',
  'creator_pending',
  'creator_available',
  'payout_in_transit',
  'platform_revenue',
  'external',
] as const

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: id(),
    kind: text('kind').notNull(),
    ownerType: text('owner_type'),
    ownerId: uuid('owner_id'),
    ...timestamps,
  },
  (t) => [
    unique('ledger_accounts_owner').on(t.kind, t.ownerType, t.ownerId).nullsNotDistinct(),
    check('ledger_accounts_kind_check', inList('kind', LEDGER_ACCOUNT_KINDS)),
  ],
)

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: id(),
  kind: text('kind').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  campaignId: uuid('campaign_id'),
  submissionId: uuid('submission_id'),
  creatorId: uuid('creator_id'),
  payoutId: uuid('payout_id'),
  memo: text('memo'),
  createdBy: uuid('created_by'),
  ...timestamps,
})

// Positive amount adds to the account, negative takes from it. Each transaction's entries sum to zero
// (enforced by a deferred trigger in Phase 1).
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => ledgerTransactions.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    amountCents: cents('amount_cents').notNull(),
    ...timestamps,
  },
  (t) => [index('ledger_entries_account').on(t.accountId), index('ledger_entries_transaction').on(t.transactionId)],
)

export const WITHDRAWAL_METHODS = ['stripe_connect', 'paypal'] as const
export const WITHDRAWAL_STATUSES = ['requested', 'approved', 'in_batch', 'sent', 'paid', 'failed', 'cancelled'] as const

export const payoutBatches = pgTable('payout_batches', {
  id: id(),
  createdBy: uuid('created_by').references(() => users.id),
  status: text('status'),
  sentAt: tz('sent_at'),
  ...timestamps,
})

export const withdrawals = pgTable(
  'withdrawals',
  {
    id: id(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    method: text('method').notNull(),
    amountCents: cents('amount_cents').notNull(),
    feeCents: cents('fee_cents').notNull(),
    netCents: cents('net_cents').notNull(),
    status: text('status').notNull().default('requested'),
    batchId: uuid('batch_id').references(() => payoutBatches.id),
    partnerReference: text('partner_reference'),
    failureReason: text('failure_reason'),
    ...timestamps,
  },
  () => [
    check('withdrawals_method_check', inList('method', WITHDRAWAL_METHODS)),
    check('withdrawals_status_check', inList('status', WITHDRAWAL_STATUSES)),
    check('withdrawals_net_check', sql`net_cents = amount_cents - fee_cents`),
  ],
)

// ---------- Support tables ----------

export const notifications = pgTable('notifications', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  readAt: tz('read_at'),
  ...timestamps,
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  ...timestamps,
})

export const reasonCodes = pgTable('reason_codes', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  appliesTo: text('applies_to').array(),
  creatorMessage: text('creator_message').notNull(),
  ...timestamps,
})

// Append only. A trigger in the migrations blocks UPDATE and DELETE.
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ...timestamps,
  },
  (t) => [index('audit_log_entity').on(t.entity, t.entityId), index('audit_log_created').on(t.createdAt)],
)

export const apiKeys = pgTable('api_keys', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  keyHash: text('key_hash').notNull().unique(),
  label: text('label'),
  lastUsedAt: tz('last_used_at'),
  revokedAt: tz('revoked_at'),
  ...timestamps,
})

// Legal pages (terms, privacy, campaign rules, cookies). Every change is a new version; the newest
// version whose effective date has passed is the one in force (01_PRODUCT.md section 8.1).
export const LEGAL_SLUGS = ['terms', 'privacy', 'campaign-rules', 'cookies', 'brand-terms'] as const

export const legalDocuments = pgTable(
  'legal_documents',
  {
    id: id(),
    slug: text('slug').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    effectiveAt: tz('effective_at').notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('legal_documents_slug_version').on(t.slug, t.version),
    check('legal_documents_slug_check', inList('slug', LEGAL_SLUGS)),
  ],
)
