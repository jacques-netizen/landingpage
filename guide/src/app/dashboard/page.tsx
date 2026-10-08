// Internal funnel dashboard (section 11.2). Password protected. Not linked.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Logo } from "@/components/funnel/ui";
import { DASH_COOKIE, dashCookieValue } from "@/lib/server/dashauth";
import { config } from "@/lib/server/config";
import { dropOff, eventCounts, funnel, rangeFor, videoWatch, type FunnelRow } from "@/lib/server/dashboard";

export const metadata = { title: "Funnel dashboard", robots: { index: false, follow: false } };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "");
const th = "py-3 pr-6 text-left text-[13px] font-medium text-muted";
const td = "py-3 pr-6 text-[14px] tabular-nums";

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  await connection();
  const sp = await searchParams;
  const authed = config().dashboardPassword && (await cookies()).get(DASH_COOKIE)?.value === dashCookieValue();
  if (!authed) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <Logo />
        <form method="post" action="/api/dashboard" className="mt-16">
          <label htmlFor="password" className="block font-serif text-subtitle">Funnel dashboard</label>
          <input id="password" name="password" type="password" autoComplete="current-password" className="mt-6 h-12 w-full border-b border-ink bg-transparent text-lg outline-none" />
          {sp.e && <p className="mt-2 text-[14px] text-proof-2">Wrong password.</p>}
          {!config().dashboardPassword && <p className="mt-2 text-[14px] text-proof-2">Set DASHBOARD_PASSWORD to use the dashboard.</p>}
          <button type="submit" className="mt-8 h-12 rounded-pill bg-ink px-7 text-[15px] font-medium text-white">Open</button>
        </form>
      </main>
    );
  }

  const days = Math.min(90, Math.max(1, Number(sp.days) || 14));
  const { from, to } = rangeFor(days);
  const [rows, drops, videos, events] = await Promise.all([funnel(from, to), dropOff(from, to), videoWatch(from, to), eventCounts(from, to)]);

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
                <tbody><tr className="border-b border-line">{cols.map(([k]) => <td key={k} className={td}>{t[k]}{k !== "starts" && t.starts ? <span className="ml-1 text-muted">{pct(t[k], t.starts)}</span> : null}</td>)}</tr></tbody>
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
                <tr key={`${r.day}${r.variant}${r.path}`} className="border-b border-line">
                  <td className={td}>{r.day}</td><td className={td}>{r.variant}</td><td className={td}>{r.path}</td>
                  {cols.map(([k]) => <td key={k} className={td}>{r[k]}</td>)}
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
            <tbody>{drops.map((d) => <tr key={d.variant + d.scene} className="border-b border-line"><td className={td}>{d.variant}</td><td className={td}>{d.scene}</td><td className={td}>{d.sessions}</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2 className="font-serif text-subtitle">Film watch</h2>
          <p className="mt-2 text-[14px] text-muted">Sessions reaching each quarter, and the average share watched.</p>
          <table className="mt-4 w-full border-t border-line">
            <thead><tr className="border-b border-line">{["Film", "Plays", "25%", "50%", "75%", "100%", "Avg"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{videos.map((v) => <tr key={v.media} className="border-b border-line"><td className={td}>{v.media}</td><td className={td}>{v.plays}</td><td className={td}>{v.p25}</td><td className={td}>{v.p50}</td><td className={td}>{v.p75}</td><td className={td}>{v.p100}</td><td className={td}>{v.avg_pct}%</td></tr>)}</tbody>
          </table>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">All events</h2>
        <table className="mt-4 w-full max-w-md border-t border-line">
          <tbody>{events.map((e) => <tr key={e.name} className="border-b border-line"><td className={td}>{e.name}</td><td className={td}>{e.count}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
