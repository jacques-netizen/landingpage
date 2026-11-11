// Adds up the opt-in funnel for /dashboard. Pure functions: no database, so
// the arithmetic is covered by unit tests.

/** One visit to the opt-in page and how far it got. */
export type VisitRow = {
  day: string;
  source: string;
  device: string;
  name_done: boolean;
  lead: boolean;
  emailed: boolean;
  thanks: boolean;
  book_click: boolean;
  guide_open: boolean;
  guide_end: boolean;
  booked: boolean;
};
export type ErrorRow = { field: string; times: number; people: number };
export type JobRow = { kind: string; status: string; leads: number };

export type Totals = {
  visits: number;
  nameDone: number;
  leads: number;
  emailed: number;
  thanks: number;
  bookClick: number;
  guideOpen: number;
  guideEnd: number;
  booked: number;
};

const empty = (): Totals => ({ visits: 0, nameDone: 0, leads: 0, emailed: 0, thanks: 0, bookClick: 0, guideOpen: 0, guideEnd: 0, booked: 0 });

/** Postgres drivers hand booleans back as true, "t" or 1 depending on the driver. */
const yes = (v: unknown) => v === true || v === "t" || v === "true" || v === 1;

function add(t: Totals, r: VisitRow) {
  t.visits += 1;
  if (yes(r.name_done)) t.nameDone += 1;
  if (yes(r.lead)) t.leads += 1;
  if (yes(r.emailed)) t.emailed += 1;
  if (yes(r.thanks)) t.thanks += 1;
  if (yes(r.book_click)) t.bookClick += 1;
  if (yes(r.guide_open)) t.guideOpen += 1;
  if (yes(r.guide_end)) t.guideEnd += 1;
  if (yes(r.booked)) t.booked += 1;
}

export function totals(rows: VisitRow[]): Totals {
  const t = empty();
  for (const r of rows) add(t, r);
  return t;
}

export type Group = Totals & { key: string };

/** Totals per value of one column. Sorted by visits, or by key (newest first) for days. */
export function groupBy(rows: VisitRow[], key: "day" | "source" | "device"): Group[] {
  const m = new Map<string, Totals>();
  for (const r of rows) {
    const k = String(r[key] ?? "") || "unknown";
    if (!m.has(k)) m.set(k, empty());
    add(m.get(k)!, r);
  }
  const out = [...m.entries()].map(([k, t]) => ({ key: k, ...t }));
  return key === "day" ? out.sort((a, b) => b.key.localeCompare(a.key)) : out.sort((a, b) => b.visits - a.visits || a.key.localeCompare(b.key));
}

/** A share as whole percent text, or "" when there is nothing to divide by. Under 1% shows as "<1%". */
export function pct(part: number, whole: number): string {
  if (!whole) return "";
  const p = (part / whole) * 100;
  if (part > 0 && p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

const DEVICES: Record<string, string> = {
  ig_inapp: "Instagram in-app browser",
  fb_inapp: "Facebook in-app browser",
  ios: "iPhone or iPad browser",
  android: "Android browser",
  desktop: "Computer",
};
export const deviceLabel = (d: string) => DEVICES[d] ?? d;

const ERRORS: Record<string, string> = {
  optin_step_1: "Name step: first or last name missing",
  optin_step_2: "Contact step: email or WhatsApp number not valid",
  email: "Email refused by the server",
  phone: "WhatsApp number refused by the server",
  firstName: "First name refused by the server",
  lastName: "Last name refused by the server",
  network: "Connection problem while sending",
  bot: "Bot check failed",
  rate_limited: "Too many tries in a short time",
  consent: "Consent missing",
};
export const errorLabel = (f: string) => ERRORS[f] ?? f;

const JOBS: Record<string, string> = {
  email: "Guide email",
  crm: "Contact added to GoHighLevel",
  capi: "Lead sent to Meta",
  discord: "Discord alert",
  manychat: "ManyChat tag",
  booking_crm: "Booking moved in GoHighLevel",
  booking_capi: "Booking sent to Meta",
  booking_discord: "Discord booking alert",
};
const JOB_ORDER = Object.keys(JOBS);

export type FollowUp = { kind: string; label: string; done: number; skipped: number; waiting: number; failed: number };

/** One line per automatic step: how many went through, were skipped, are waiting or failed for good. */
export function followUpTable(rows: JobRow[]): FollowUp[] {
  const m = new Map<string, FollowUp>();
  for (const r of rows) {
    if (!JOBS[r.kind]) continue; // write and pdf belong to the older film funnel
    if (!m.has(r.kind)) m.set(r.kind, { kind: r.kind, label: JOBS[r.kind], done: 0, skipped: 0, waiting: 0, failed: 0 });
    const f = m.get(r.kind)!;
    const n = Number(r.leads) || 0;
    if (r.status === "done") f.done += n;
    else if (r.status === "skipped") f.skipped += n;
    else if (r.status === "dead") f.failed += n;
    else f.waiting += n; // pending, running, or failed and due for another try
  }
  return [...m.values()].sort((a, b) => JOB_ORDER.indexOf(a.kind) - JOB_ORDER.indexOf(b.kind));
}
