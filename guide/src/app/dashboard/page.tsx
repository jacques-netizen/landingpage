// Internal funnel dashboard (section 11.2). Not linked, not indexed, no password. Counts only.
import { connection } from "next/server";
import { Logo } from "@/components/funnel/ui";
import { dropOff, eventCounts, funnel, rangeFor, videoWatch, type FunnelRow } from "@/lib/server/dashboard";

export const metadata = { title: "Funnel dashboard", robots: { index: false, follow: false } };
export const maxDuration = 60;

const pct = (a: number, b: number) => (Number(b) ? `${Math.round((Number(a) / Number(b)) * 100)}%` : "");
/** Anything the database hands back, as text. Never throws. */
const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
const th = "py-3 pr-6 text-left text-[13px] font-medium text-muted";
const td = "py-3 pr-6 text-[14px] tabular-nums";

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  await connection();
  const sp = await searchParams;
  // Open on purpose: the page shows counts only, never names, emails or numbers.
  const days = Math.min(90, Math.max(1, Number(sp.days) || 14));
  const { from, to } = rangeFor(days);
  let rows: FunnelRow[] = [];
  let drops: Awaited<ReturnType<typeof dropOff>> = [];
  let videos: Awaited<ReturnType<typeof videoWatch>> = [];
  let events: Awaited<ReturnType<typeof eventCounts>> = [];
  let loadError = "";
  try {
    [rows, drops, videos, events] = await Promise.all([funnel(from, to), dropOff(from, to), videoWatch(from, to), eventCounts(from, to)]);
  } catch (e) {
    // This page is for the owner only: showing the database error beats a blank 500.
    // Drizzle wraps the driver error; the useful part is the cause.
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : "";
    loadError = cause || (e instanceof Error ? e.message.split("\n")[0].slice(0, 300) : String(e));
    console.error("dashboard query failed", loadError);
  }

  const totals = (variant: string) => {
    const r = rows.filter((x) => x.variant === variant);
    const sum = (k: keyof FunnelRow) => r.reduce((a, x) => a + Number(x[k]), 0);
    return { starts: sum("starts"), q1: sum("q1"), gate_views: sum("gate_views"), gate_submits: sum("gate_submits"), emails: sum("emails"), result_views: sum("result_views"), booking_views: sum("booking_views"), bookings: sum("bookings") };
  };
  const cols: [keyof ReturnType<typeof totals>, string][] = [
    ["starts", "Starts"], ["q1", "Q1 done"], ["gate_views", "Gate views"], ["gate_submits", "Gate submits"], ["emails", "Emails sent"],
    ["result_views", "Result views"], ["booking_views", "Booking views"], ["bookings", "Bookings"],
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <nav className="flex gap-4 text-[14px]">
          {[7, 14, 30, 90].map((d) => (
            <a key={d} href={`/dashboard?days=${d}`} className={d === days ? "font-semibold text-ink" : "text-muted hover:text-ink"}>{d} days</a>
          ))}
        </nav>
      </header>

      <h1 className="mt-14 font-serif text-display">Funnel, last {days} days</h1>
      {loadError && (
        <p role="alert" className="mt-6 border border-proof-2 p-4 text-[14px] text-proof-2">
          The numbers could not be loaded. Database error: {loadError}
        </p>
      )}
      {(["full", "plain"] as const).map((v) => {
        const t = totals(v);
        return (
          <section key={v} className="mt-10">
            <h2 className="font-serif text-subtitle">{v === "full" ? "Full experience" : "Plain control"}</h2>
            <p className="mt-2 text-[15px] text-muted">
              Gate submit rate {pct(t.gate_submits, t.starts) || "n/a"}. Bookings per qualified lead are in the table below.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-t border-line">
                <thead><tr className="border-b border-line">{cols.map(([, l]) => <th key={l} className={th}>{l}</th>)}</tr></thead>
                <tbody><tr className="border-b border-line">{cols.map(([k]) => <td key={k} className={td}>{cell(t[k])}{k !== "starts" && t.starts ? <span className="ml-1 text-muted">{pct(t[k], t.starts)}</span> : null}</td>)}</tr></tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">By day, variant and path</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-t border-line">
            <thead><tr className="border-b border-line"><th className={th}>Day</th><th className={th}>Variant</th><th className={th}>Path</th>{cols.map(([, l]) => <th key={l} className={th}>{l}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${cell(r.day)}${cell(r.variant)}${cell(r.path)}`} className="border-b border-line">
                  <td className={td}>{cell(r.day)}</td><td className={td}>{cell(r.variant)}</td><td className={td}>{cell(r.path)}</td>
                  {cols.map(([k]) => <td key={k} className={td}>{cell(r[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-16 grid gap-16 md:grid-cols-2">
        <section>
          <h2 className="font-serif text-subtitle">Where people stopped</h2>
          <p className="mt-2 text-[14px] text-muted">Last scene seen by sessions that did not reach the gate submit.</p>
          <table className="mt-4 w-full border-t border-line">
            <thead><tr className="border-b border-line"><th className={th}>Variant</th><th className={th}>Scene</th><th className={th}>Sessions</th></tr></thead>
            <tbody>{drops.map((d, i) => <tr key={i} className="border-b border-line"><td className={td}>{cell(d.variant)}</td><td className={td}>{cell(d.scene)}</td><td className={td}>{cell(d.sessions)}</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2 className="font-serif text-subtitle">Film watch</h2>
          <p className="mt-2 text-[14px] text-muted">Sessions reaching each quarter, and the average share watched.</p>
          <table className="mt-4 w-full border-t border-line">
            <thead><tr className="border-b border-line">{["Film", "Plays", "25%", "50%", "75%", "100%", "Avg"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{videos.map((v, i) => <tr key={i} className="border-b border-line"><td className={td}>{cell(v.media)}</td><td className={td}>{cell(v.plays)}</td><td className={td}>{cell(v.p25)}</td><td className={td}>{cell(v.p50)}</td><td className={td}>{cell(v.p75)}</td><td className={td}>{cell(v.p100)}</td><td className={td}>{cell(v.avg_pct)}%</td></tr>)}</tbody>
          </table>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">All events</h2>
        <table className="mt-4 w-full max-w-md border-t border-line">
          <tbody>{events.map((e, i) => <tr key={i} className="border-b border-line"><td className={td}>{cell(e.name)}</td><td className={td}>{cell(e.count)}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
