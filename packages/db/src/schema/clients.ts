import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { id, timestamps } from './_shared'

export const clients = pgTable('clients', {
  id: id(),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  /** MDE fee on top of the budget, in basis points, set per client. */
  serviceFeeBps: integer('service_fee_bps').notNull().default(0),
  notes: text('notes'),
  ...timestamps,
})
