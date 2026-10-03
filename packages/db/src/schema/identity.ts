import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { citext, id, timestamps, tz } from './_shared'

/*
 * Property names `name`, `image` and `emailVerified` follow what the Auth.js database adapter expects.
 * The database columns keep the names from docs/02_DATA_AND_MONEY.md.
 */
export const users = pgTable(
  'users',
  {
    id: id(),
    email: citext('email').notNull().unique(),
    emailVerified: tz('email_verified'),
    name: text('display_name'),
    image: text('avatar_url'),
    isPrivateProfile: boolean('is_private_profile').notNull().default(false),
    isAdultConfirmed: boolean('is_adult_confirmed').notNull().default(false),
    adultConfirmedAt: tz('adult_confirmed_at'),
    termsAcceptedAt: tz('terms_accepted_at'),
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [check('users_status_check', sql`${t.status} in ('active','suspended','closed')`)],
)

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
    check('staff_roles_role_check', sql`${t.role} in ('reviewer','finance','admin')`),
  ],
)

/** One row per way of signing in. Doubles as the Auth.js accounts table. */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('oauth'),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_user_id').notNull(),
    // Token fields the adapter may store. Never logged. Not used by the product itself.
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
    unique('auth_identities_provider_unique').on(t.provider, t.providerAccountId),
    check('auth_identities_provider_check', sql`${t.provider} in ('email','google','discord')`),
    index('auth_identities_user_idx').on(t.userId),
  ],
)

/** Auth.js database sessions. */
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: tz('expires').notNull(),
  ...timestamps,
})

/** Auth.js magic link tokens. */
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
    ...timestamps,
  },
  (t) => [
    check(
      'creator_profiles_payout_status_check',
      sql`${t.payoutStatus} in ('none','pending','verified','restricted')`,
    ),
  ],
)
