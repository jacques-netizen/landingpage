import { sql } from 'drizzle-orm'
import { check, customType, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns'
import { clients } from './clients'
import { id, timestamps, tz } from './_shared'
import { users } from './identity'

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

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
    /** OAuth tokens, encrypted with AES-256-GCM. Null for bio code accounts. */
    tokenCiphertext: bytea('token_ciphertext'),
    status: text('status').notNull().default('pending'),
    lastCheckedAt: tz('last_checked_at'),
    ...timestamps,
  },
  (t) => [
    // One platform account belongs to one creator.
    unique('linked_accounts_platform_user_unique').on(t.platform, t.platformUserId),
    index('linked_accounts_creator_idx').on(t.creatorId),
    check(
      'linked_accounts_platform_check',
      sql`${t.platform} in ('tiktok','instagram','youtube','x')`,
    ),
    check('linked_accounts_method_check', sql`${t.linkMethod} in ('oauth','bio_code')`),
    check(
      'linked_accounts_status_check',
      sql`${t.status} in ('pending','verified','failed','removed')`,
    ),
  ],
)

export const clientReportLinks = pgTable('client_report_links', {
  id: id(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  /** Null means all of the client's campaigns. */
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  /** A hash is stored. The token is shown once. */
  tokenHash: text('token_hash').notNull().unique(),
  revokedAt: tz('revoked_at'),
  ...timestamps,
})
