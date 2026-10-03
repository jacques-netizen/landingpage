import { customType, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Case-insensitive text. Needs the citext extension (created in the first migration). */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})

export const id = () => uuid('id').primaryKey().defaultRandom()

/** Every table has created_at and updated_at in UTC. A trigger keeps updated_at current. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const tz = (name: string) => timestamp(name, { withTimezone: true })
