import { sql } from 'drizzle-orm'
import { bigserial, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id, timestamps, tz } from './_shared'
import { users } from './identity'

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
  appliesTo: text('applies_to')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  creatorMessage: text('creator_message').notNull(),
  ...timestamps,
})

/** Rows cannot be updated or deleted. A trigger enforces it. */
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  ...timestamps,
})

/** Used by the later public API. */
export const apiKeys = pgTable('api_keys', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  keyHash: text('key_hash').notNull(),
  label: text('label'),
  lastUsedAt: tz('last_used_at'),
  revokedAt: tz('revoked_at'),
  ...timestamps,
})
