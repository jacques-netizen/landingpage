import "server-only";
// Numbers for /dashboard: the opt-in funnel as it runs today. One row per
// visit comes out of the database; the adding up happens in funnel-stats.ts.
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import type { ErrorRow, JobRow, VisitRow } from "@/lib/funnel-stats";

/** Dates go to the driver as ISO text: postgres.js (production) cannot bind a Date inside raw sql, PGlite can. */
const iso = (d: Date) => d.toISOString();

async function rows<T>(q: SQL): Promise<T[]> {
  const db = await getDb();
  const r = (await db.execute(q)) as unknown;
  return (Array.isArray(r) ? r : (r as { rows: T[] }).rows) as T[];
}

/**
 * A visit belongs to the opt-in funnel when it opened the opt-in page (its
 * events carry variant "optin") or left an opt-in lead. Visits to the older
 * film funnel are left out.
 */
const optinVisits = (from: Date, to: Date) => sql`
  select s.id, s.created_at, s.source, s.device_class, l.id as lead_id, l.booked_at
  from sessions s
  left join leads l on l.session_id = s.id
  where s.created_at >= ${iso(from)}::timestamptz and s.created_at < ${iso(to)}::timestamptz
    and s.device_class <> 'bot'
    and (
      l.answers->>'funnel' = 'optin' or l.answers->>'promo' is not null
      or exists (select 1 from events e where e.session_id = s.id and e.name = 'scene_view' and e.props->>'variant' = 'optin')
    )`;

export async function visits(from: Date, to: Date): Promise<VisitRow[]> {
  return rows<VisitRow>(sql`
    with v as (${optinVisits(from, to)}),
    e as (
      select e.session_id,
        bool_or(e.name = 'gate_view' or (e.name = 'scene_view' and e.props->>'scene' = 'optin_contact')) as name_done,
        bool_or(e.name = 'result_view') as thanks,
        bool_or(e.name = 'book_click') as book_click,
        bool_or(e.name = 'secrets_view') as guide_open,
        bool_or(e.name = 'secrets_end') as guide_end
      from events e join v on v.id = e.session_id
      group by e.session_id
    )
    select
      to_char(v.created_at at time zone 'Europe/Brussels', 'YYYY-MM-DD') as day,
      coalesce(nullif(v.source->>'src', ''), nullif(v.source->>'utm_source', ''), 'direct') as source,
      v.device_class as device,
      (v.lead_id is not null or coalesce(e.name_done, false)) as name_done,
      (v.lead_id is not null) as lead,
      exists (select 1 from jobs j where j.lead_id = v.lead_id and j.kind = 'email' and j.status = 'done') as emailed,
      coalesce(e.thanks, false) as thanks,
      coalesce(e.book_click, false) as book_click,
      coalesce(e.guide_open, false) as guide_open,
      coalesce(e.guide_end, false) as guide_end,
      (v.booked_at is not null) as booked
    from v left join e on e.session_id = v.id
    order by v.created_at desc
    limit 50000`);
}

/** Form errors on the opt-in page, by the step or field that failed. */
export async function formErrors(from: Date, to: Date): Promise<ErrorRow[]> {
  return rows<ErrorRow>(sql`
    with v as (${optinVisits(from, to)})
    select coalesce(e.props->>'fields', 'unknown') as field, count(*)::int as times, count(distinct e.session_id)::int as people
    from events e join v on v.id = e.session_id
    where e.name = 'gate_error'
    group by field order by times desc`);
}

/** What happened to each automatic step after a sign-up. */
export async function followUps(from: Date, to: Date): Promise<JobRow[]> {
  return rows<JobRow>(sql`
    with v as (${optinVisits(from, to)})
    select j.kind, j.status, count(*)::int as leads
    from jobs j join v on v.lead_id = j.lead_id
    group by j.kind, j.status order by j.kind, j.status`);
}

/** The first day the newer steps (Book a call clicks, guide opens) were counted, or null when none yet. */
export async function newStepsSince(): Promise<string | null> {
  const r = await rows<{ day: string | null }>(sql`
    select to_char(min(at) at time zone 'Europe/Brussels', 'YYYY-MM-DD') as day
    from events where name in ('book_click', 'secrets_view', 'secrets_end')`);
  return r[0]?.day ?? null;
}

/** The last N days up to now. */
export function rangeFor(days: number) {
  const now = Date.now();
  return { from: new Date(now - days * 86_400_000), to: new Date(now + 60_000) };
}
