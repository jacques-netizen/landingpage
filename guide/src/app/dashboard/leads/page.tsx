// Every submission with name, email and phone, newest first. Only through the
// private link /dashboard/leads?key=<DASHBOARD_PASSWORD>; anyone else gets a 404.
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/funnel/ui";
import { config } from "@/lib/server/config";
import { passwordOk } from "@/lib/server/dashauth";
import { leadCounts, leadList, type LeadListRow } from "@/lib/server/leadlist";

export const metadata = { title: "Submissions", robots: { index: false, follow: false } };
export const maxDuration = 60;

const th = "py-3 pr-5 text-left text-[12px] font-medium uppercase tracking-wide text-muted whitespace-nowrap";
const td = "py-3 pr-5 text-[14px] align-top";

export default async function Leads({ searchParams }: PageProps<"/dashboard/leads">) {
  await connection();
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key : "";
  if (!config().dashboardPassword || !passwordOk(key)) notFound();

  let rows: LeadListRow[] = [];
  let loadError = "";
  try {
    rows = await leadList();
  } catch (e) {
    loadError = e instanceof Error ? e.message.split("\n")[0].slice(0, 300) : String(e);
  }
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
  const counts = leadCounts(rows);

  return (
    <main className="min-h-dvh bg-paper px-5 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <div className="flex gap-3 text-[14px]">
            <a className="rounded-pill border border-line-strong px-4 py-2 hover:bg-white" href="/dashboard">Funnel numbers</a>
            <a className="rounded-pill bg-ink px-4 py-2 text-white hover:bg-ink-soft" href={`/api/dashboard/leads?key=${encodeURIComponent(key)}`}>Download CSV</a>
          </div>
        </div>
        <h1 className="mt-8 font-serif text-title">Submissions</h1>
        <p className="mt-2 text-[14px] text-muted">Newest first. Times in Brussels time. Keep this link private: it shows names, emails and phone numbers.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Total", counts.total], ["Today", counts.today], ["Last 7 days", counts.week], ["Booked a call", counts.booked]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-line bg-paper-light p-4">
              <div className="font-serif text-[2rem] leading-none tabular-nums">{v}</div>
              <div className="mt-1 text-[13px] text-muted">{l}</div>
            </div>
          ))}
        </div>
        {loadError && <p className="mt-6 text-[14px] text-proof-2">Could not load the submissions: {loadError}</p>}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>When</th><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Phone</th>
                <th className={th}>Page</th><th className={th}>Booked</th><th className={th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td className={`${td} whitespace-nowrap tabular-nums text-muted`}>{fmt(r.at)}</td>
                  <td className={`${td} font-medium`}>{r.firstName} {r.lastName}</td>
                  <td className={td}><a className="underline-offset-4 hover:underline" href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{r.phone ? <a className="underline-offset-4 hover:underline" href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{r.phone}</a> : ""}</td>
                  <td className={td}>{r.funnel === "opt-in" ? "Opt-in" : `Film (${r.path})`}</td>
                  <td className={td}>{r.booked ? "Yes" : ""}</td>
                  <td className={`${td} text-muted`}>{r.source}{r.campaign ? ` / ${r.campaign}` : ""}</td>
                </tr>
              ))}
              {!rows.length && !loadError && (
                <tr><td className={`${td} text-muted`} colSpan={7}>No submissions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
