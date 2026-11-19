import { sql } from 'drizzle-orm'

/**
 * The views staff pages and the client report show for a post: the higher of its scraped (or verified)
 * latest views and the figure from its page owner's insights, when staff added one (owner, 2026-11-19).
 * For display only. Never use it for anything that pays: earnings come from counted views.
 * `alias` is the submissions table's alias in the query, like `s`.
 */
export function shownViews(alias: string) {
  if (!/^[a-z_]+$/.test(alias)) throw new Error('bad alias')
  return sql.raw(
    `greatest(${alias}.latest_views, coalesce((select pi.views from post_insights pi where pi.submission_id = ${alias}.id), 0))`,
  )
}
