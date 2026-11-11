// The owner's funnel dashboard: the opt-in funnel as it runs today. Opt-in
// page, sign-up, guide email, thanks page, guide, booked call. Not linked,
// not indexed. Counts only, never names, emails or numbers.
import { connection } from "next/server";
import { Logo } from "@/components/funnel/ui";
import { followUps, formErrors, newStepsSince, rangeFor, visits } from "@/lib/server/dashboard";
import { deviceLabel, errorLabel, followUpTable, groupBy, pct, totals, type ErrorRow, type Group, type JobRow, type VisitRow } from "@/lib/funnel-stats";

export const metadata = { title: "Funnel dashboard", robots: { index: false, follow: false } };
export const maxDuration = 60;

const RANGES = [7, 14, 30, 90];
const th = "py-3 pr-6 text-left align-bottom text-[13px] font-medium text-muted";
const thNum = `${th} text-right`;
const td = "py-3 pr-6 text-[14px]";
const tdNum = `${td} text-right tabular-nums`;
const tdShare = `${td} text-right tabular-nums text-muted`;

const longDay = (d: string) => {
  const t = Date.parse(`${d}T12:00:00Z`);
  return Number.isNaN(t) ? d : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(t);
};
const people = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** Visits, sign-ups and booked calls for one way of cutting the visits (source, device or day). */
function Breakdown({ label, groups, name }: { label: string; groups: Group[]; name: (key: string) => string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-t border-line">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>{label}</th>
            <th className={thNum}>Visits</th>
            <th className={thNum}>Sign-ups</th>
            <th className={thNum}>Sign-up rate</th>
            <th className={thNum}>Booked calls</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-b border-line">
              <td className={td}>{name(g.key)}</td>
              <td className={tdNum}>{g.visits}</td>
              <td className={tdNum}>{g.leads}</td>
              <td className={tdShare}>{pct(g.leads, g.visits)}</td>
              <td className={tdNum}>{g.booked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  await connection();
  const sp = await searchParams;
  // Open on purpose: the page shows counts only, never names, emails or numbers.
  const days = Math.min(90, Math.max(1, Number(sp.days) || 14));
  const { from, to } = rangeFor(days);
  let rows: VisitRow[] = [];
  let errors: ErrorRow[] = [];
  let jobs: JobRow[] = [];
  let since: string | null = null;
  let loadError = "";
  try {
    [rows, errors, jobs, since] = await Promise.all([visits(from, to), formErrors(from, to), followUps(from, to), newStepsSince()]);
  } catch (e) {
    // This page is for the owner only: showing the database error beats a blank 500.
    // Drizzle wraps the driver error; the useful part is the cause.
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : "";
    loadError = cause || (e instanceof Error ? e.message.split("\n")[0].slice(0, 300) : String(e));
    console.error("dashboard query failed", loadError);
  }

  const t = totals(rows);
  const follow = followUpTable(jobs);
  // Each step, the people who reached it, and what it is a share of.
  const steps: { label: string; note?: string; n: number; ofVisits: boolean }[] = [
    { label: "Opened the opt-in page", n: t.visits, ofVisits: true },
    { label: "Filled in their name", note: "Step 1 of the form", n: t.nameDone, ofVisits: true },
    { label: "Signed up", note: "Step 2: email and WhatsApp number", n: t.leads, ofVisits: true },
    { label: "Got the guide email", n: t.emailed, ofVisits: false },
    { label: "Saw the thanks page", note: "The film, the calendar and the reviews", n: t.thanks, ofVisits: false },
    { label: "Pressed Book a call", note: "The button under the film", n: t.bookClick, ofVisits: false },
    { label: "Opened the guide", note: "The 7 secrets page", n: t.guideOpen, ofVisits: false },
    { label: "Reached the calendar in the guide", n: t.guideEnd, ofVisits: false },
    { label: "Booked a call", n: t.booked, ofVisits: false },
  ];
  const leftName = t.visits - t.nameDone;
  const leftContact = t.nameDone - t.leads;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 md:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <nav className="flex gap-4 text-[14px]">
          {RANGES.map((d) => (
            <a key={d} href={`/dashboard?days=${d}`} className={d === days ? "font-semibold text-ink" : "text-muted hover:text-ink"}>{d} days</a>
          ))}
        </nav>
      </header>

      <h1 className="mt-14 font-serif text-display">Opt-in funnel, last {days} days</h1>
      {loadError ? (
        <p role="alert" className="mt-6 border border-proof-2 p-4 text-[14px] text-proof-2">
          The numbers could not be loaded. Database error: {loadError}
        </p>
      ) : (
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed">
          {people(t.visits, "visit", "visits")} to the opt-in page, {people(t.leads, "sign-up", "sign-ups")}
          {t.visits ? ` (${pct(t.leads, t.visits)} of visits)` : ""}, {people(t.booked, "booked call", "booked calls")}
          {t.leads ? ` (${pct(t.booked, t.leads)} of sign-ups)` : ""}.
        </p>
      )}

      <section className="mt-14">
        <h2 className="font-serif text-subtitle">Step by step</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-t border-line">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Step</th>
                <th className={thNum}>People</th>
                <th className={thNum}>Of visits</th>
                <th className={thNum}>Of sign-ups</th>
                <th className={`${th} hidden w-[28%] md:table-cell`} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.label} className="border-b border-line">
                  <td className={td}>
                    {s.label}
                    {s.note ? <span className="block text-[13px] text-muted">{s.note}</span> : null}
                  </td>
                  <td className={`${tdNum} text-[16px] font-medium`}>{s.n.toLocaleString("en-US")}</td>
                  <td className={tdShare}>{pct(s.n, t.visits)}</td>
                  <td className={tdShare}>{s.ofVisits ? "" : pct(s.n, t.leads)}</td>
                  <td className={`${td} hidden md:table-cell`} aria-hidden="true">
                    <span className="block h-[6px] bg-ink" style={{ width: `${t.visits ? Math.max(s.n ? 1 : 0, (s.n / t.visits) * 100) : 0}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-[14px] text-muted">
          {since
            ? `Book a call presses and guide opens are counted from ${longDay(since)}. Sign-ups before that day show none.`
            : "Book a call presses and guide opens have just been added, so they start at zero."}{" "}
          A guide open is counted when the person opens it from the email or in the browser they signed up in. A booked call is counted when Cal.com confirms the booking.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">Where people leave the form</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full max-w-2xl border-t border-line">
            <tbody>
              <tr className="border-b border-line">
                <td className={td}>Left before filling in their name</td>
                <td className={tdNum}>{leftName}</td>
                <td className={tdShare}>{pct(leftName, t.visits)} of visits</td>
              </tr>
              <tr className="border-b border-line">
                <td className={td}>Gave their name, left at email and WhatsApp</td>
                <td className={tdNum}>{leftContact}</td>
                <td className={tdShare}>{pct(leftContact, t.nameDone)} of those who gave a name</td>
              </tr>
            </tbody>
          </table>
        </div>
        {errors.length > 0 && (
          <>
            <h3 className="mt-10 text-[15px] font-semibold">Error messages people saw</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full max-w-2xl border-t border-line">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Message</th>
                    <th className={thNum}>Times shown</th>
                    <th className={thNum}>People</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e) => (
                    <tr key={e.field} className="border-b border-line">
                      <td className={td}>{errorLabel(e.field)}</td>
                      <td className={tdNum}>{e.times}</td>
                      <td className={tdNum}>{e.people}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">Where visits come from</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-muted">The src value on the link that was sent, such as the ManyChat keyword link. Links with no src show as direct.</p>
        <Breakdown label="Source" groups={groupBy(rows, "source")} name={(k) => k} />
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">What they open it in</h2>
        <Breakdown label="Browser" groups={groupBy(rows, "device")} name={deviceLabel} />
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">After the sign-up</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-muted">What the site does on its own for each sign-up. Skipped means that step is switched off or did not apply to that person.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full max-w-3xl border-t border-line">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Step</th>
                <th className={thNum}>Done</th>
                <th className={thNum}>Skipped</th>
                <th className={thNum}>Waiting</th>
                <th className={thNum}>Failed</th>
              </tr>
            </thead>
            <tbody>
              {follow.map((f) => (
                <tr key={f.kind} className="border-b border-line">
                  <td className={td}>{f.label}</td>
                  <td className={tdNum}>{f.done}</td>
                  <td className={tdNum}>{f.skipped}</td>
                  <td className={tdNum}>{f.waiting}</td>
                  <td className={`${tdNum} ${f.failed ? "font-semibold text-proof-2" : ""}`}>{f.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-subtitle">Day by day</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-muted">Days in Brussels time. A booked call is listed on the day that person first visited.</p>
        <Breakdown label="Day" groups={groupBy(rows, "day")} name={longDay} />
      </section>

      <p className="mt-16 max-w-2xl text-[14px] text-muted">
        This page counts the opt-in funnel only: the opt-in page, the thanks page and the guide. Names, emails and numbers are on the private submissions page.
      </p>
    </main>
  );
}
