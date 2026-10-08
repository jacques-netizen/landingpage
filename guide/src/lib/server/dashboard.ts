import "server-only";
// Funnel numbers for /dashboard (section 11.2), by day, variant and path.
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";

async function rows<T>(q: SQL): Promise<T[]> {
  const db = await getDb();
  const r = (await db.execute(q)) as unknown;
  return (Array.isArray(r) ? r : (r as { rows: T[] }).rows) as T[];
}

export type FunnelRow = {
  day: string;
  variant: string;
  path: string;
  starts: number;
  q1: number;
  gate_views: number;
  gate_submits: number;
  emails: number;
  result_views: number;
  booking_views: number;
  bookings: number;
};

export async function funnel(from: Date, to: Date): Promise<FunnelRow[]> {
  return rows<FunnelRow>(sql`
    with s as (
      select s.id, s.variant, to_char(date_trunc('day', s.created_at), 'YYYY-MM-DD') as day,
        coalesce(l.path, a.value #>> '{}', 'none') as path,
        l.id as lead_id, l.booked_at, g.emailed_at
      from sessions s
      left join answers a on a.session_id = s.id and a.question_id = 'role'
      left join leads l on l.session_id = s.id
      left join guides g on g.lead_id = l.id
      where s.created_at >= ${from} and s.created_at < ${to} and s.device_class <> 'bot'
    ),
    e as (
      select session_id, name from events
      where at >= ${from} and name in ('gate_view','result_view','booking_view','scene_view','question_answered')
      group by session_id, name
    )
    select day, variant, path,
      count(*)::int as starts,
      count(*) filter (where path <> 'none')::int as q1,
      count(*) filter (where exists (select 1 from e where e.session_id = s.id and e.name = 'gate_view'))::int as gate_views,
      count(lead_id)::int as gate_submits,
      count(emailed_at)::int as emails,
      count(*) filter (where exists (select 1 from e where e.session_id = s.id and e.name = 'result_view'))::int as result_views,
      count(*) filter (where exists (select 1 from e where e.session_id = s.id and e.name = 'booking_view'))::int as booking_views,
      count(booked_at)::int as bookings
    from s
    group by day, variant, path
    order by day desc, variant, path`);
}

export type DropRow = { variant: string; scene: string; sessions: number };
export async function dropOff(from: Date, to: Date): Promise<DropRow[]> {
  return rows<DropRow>(sql`
    select s.variant, coalesce(s.last_scene, 'none') as scene, count(*)::int as sessions
    from sessions s left join leads l on l.session_id = s.id
    where l.id is null and s.created_at >= ${from} and s.created_at < ${to} and s.device_class <> 'bot'
    group by s.variant, scene order by s.variant, sessions desc`);
}

export type VideoRow = { media: string; plays: number; p25: number; p50: number; p75: number; p100: number; avg_pct: number };
export async function videoWatch(from: Date, to: Date): Promise<VideoRow[]> {
  return rows<VideoRow>(sql`
    with p as (
      select session_id, props->>'media' as media, max((props->>'pct')::int) as pct
      from events where name = 'video_progress' and at >= ${from} and at < ${to}
      group by session_id, media
    ),
    pl as (
      select props->>'media' as media, count(distinct session_id)::int as plays
      from events where name = 'video_play' and at >= ${from} and at < ${to} group by media
    )
    select coalesce(pl.media, p.media) as media, coalesce(max(pl.plays), 0)::int as plays,
      count(*) filter (where p.pct >= 25)::int as p25, count(*) filter (where p.pct >= 50)::int as p50,
      count(*) filter (where p.pct >= 75)::int as p75, count(*) filter (where p.pct >= 100)::int as p100,
      coalesce(round(avg(p.pct)), 0)::int as avg_pct
    from pl full outer join p on p.media = pl.media
    group by coalesce(pl.media, p.media) order by media`);
}

export type EventRow = { name: string; count: number };
export async function eventCounts(from: Date, to: Date): Promise<EventRow[]> {
  return rows<EventRow>(sql`select name, count(*)::int as count from events where at >= ${from} and at < ${to} group by name order by name`);
}

/** The last N days up to now. */
export function rangeFor(days: number) {
  const now = Date.now();
  return { from: new Date(now - days * 86_400_000), to: new Date(now + 60_000) };
}
