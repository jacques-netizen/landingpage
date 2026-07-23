/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch (Rule 0: campus names/promises/counts come from the
 * DB). Case-study numbers below are the founder's real track record at
 * Maison d'Élites, not curriculum content, so they're static here.
 *
 * Copy follows the plain-declarative / restrained registers: description
 * over benefit, numbers over adjectives, no explanation of what a feature
 * "means." No campus is locked — every module is open from day one.
 */
import Link from "next/link";
import { Caption } from "@/components/Caption";
import { Stamp } from "@/components/Stamp";
import { toRoman } from "@/lib/roman";

export type LandingSchool = { slug: string; name: string; tagline: string | null };
export type LandingCampus = { slug: string; name: string; promise: string | null; moduleCount: number };

const CASE_STUDIES = [
  { client: "Walmart", vertical: "Retail", stat: "17M", statLabel: "views", detail: "0.2% conversion, roughly 34,000 actions." },
  { client: "Iman Gadzhi", vertical: "Education", stat: "42.2M", statLabel: "views in 90 days", detail: "94.1% of reach from non-followers." },
  { client: "Luke Belmar", vertical: "Entrepreneurship", stat: "200M", statLabel: "views a month", detail: "Capital Club, $19M in referred revenue." },
];

const STEPS = [
  { num: "01", title: "Pick your school", body: "Founders or artists. Every campus is open from day one." },
  { num: "02", title: "Work the module", body: "Watch the lesson. Produce the artifact it asks for." },
  { num: "03", title: "Ship and stamp", body: "File the work. It becomes a stamp on your register." },
];

export function LandingView({
  schools,
  campuses,
  totalModules,
}: {
  schools: LandingSchool[];
  campuses: LandingCampus[];
  totalModules: number;
}) {
  return (
    <main className="bg-ink pt-[76px]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1300px 820px at 72% -6%, rgba(217,176,99,0.13), transparent 56%), radial-gradient(1100px 900px at 6% 108%, rgba(217,176,99,0.07), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-24 sm:py-32">
          <Caption>École — founders and artists</Caption>
          <h1 className="mt-6 max-w-[16ch] font-display text-[42px] leading-[0.98] tracking-[-0.01em] text-cream-bright sm:text-[64px] md:text-[76px]">
            Marketing training for founders and artists.
          </h1>
          <p className="mt-8 max-w-[52ch] text-base leading-[1.65] text-cream/72">
            {campuses.length} campuses. {totalModules} modules. Cold outreach, LinkedIn at scale, short-form
            distribution, brand deals, the systems that run without you.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href="/join"
              className="rounded-[2px] border border-gold bg-gold px-7 py-3.5 font-body text-sm font-semibold tracking-[0.02em] text-ink transition-colors hover:bg-gold-bright"
            >
              Enter École →
            </Link>
            <span className="font-mono text-xs tracking-[0.04em] text-cream/55 uppercase">
              300M+ views delivered · 80+ brand partnerships
            </span>
          </div>
        </div>
      </div>

      {/* Method */}
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <Caption>The method</Caption>
        <h2 className="mt-5 max-w-[16ch] font-display text-[32px] leading-[1.05] tracking-[-0.01em] text-cream-bright sm:text-[44px]">
          Two schools. One method.
        </h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <p className="text-base leading-[1.7] text-cream/70">
            Most courses measure hours watched. You finish with a shelf of finished videos and nothing that exists
            outside the player.
          </p>
          <p className="text-base leading-[1.7] text-cream/70">
            École measures shipped work. Ship an assignment, earn a <span className="text-gold">stamp</span>. Every
            campus is open from day one — work in whatever order fits what you're building this week.
          </p>
        </div>
      </div>

      {/* Feature blocks */}
      <div className="mx-auto max-w-3xl px-6 py-4">
        <div className="flex flex-col gap-20 sm:gap-28">
          <FeatureBlock
            num="01"
            glyph="foundation"
            title="A register, not a transcript."
            body={`${totalModules} modules across ${campuses.length} campuses. Ship an assignment, earn a stamp. No locked campuses, no forced order.`}
            points={["Ship an assignment, earn a stamp", "Every stamp is dated and campus-marked", "Work any campus in any order"]}
          />
          <FeatureBlock
            num="02"
            glyph="linkedin"
            title="Two schools, one spine."
            body="Founders and artists study the same operating spine: outreach, distribution, systems. Shared campuses adapt to the school you're in."
            points={["Founders: cold outreach, LinkedIn, CRM", "Artists: content, distribution, brand deals", "Shared: IG organic, YouTube, short-form"]}
          />
          <FeatureBlock
            num="03"
            glyph="crm"
            title="Built by the person running these campaigns."
            body="Jacques Amoako runs Maison d'Élites: 300M+ views delivered, 80+ brand partnerships. Campaigns for Walmart, Iman Gadzhi and the Paul American launch."
            points={["17M views on the Walmart campaign", "42.2M views for Iman Gadzhi in 90 days", "200M views a month running Capital Club"]}
          />
        </div>
      </div>

      {/* Campus grid */}
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
        <Caption>The curriculum</Caption>
        <h2 className="mt-5 max-w-[16ch] font-display text-[32px] leading-[1.05] tracking-[-0.01em] text-cream-bright sm:text-[44px]">
          What you build.
        </h2>
        <p className="mt-4 max-w-[52ch] text-base text-cream/68">
          {campuses.length} campuses. Work them in any order.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campuses.map((c, i) => (
            <div key={c.slug} className="border border-cream/12 p-6">
              <div className="flex items-center justify-between">
                <Stamp campusSlug={c.slug} earned size={48} />
                <span className="font-mono text-xs text-cream/40">{toRoman(i + 1)}</span>
              </div>
              <div className="mt-5 font-display text-xl text-cream-bright">{c.name}</div>
              {c.promise && <p className="mt-2 text-sm leading-[1.55] text-cream/62">{c.promise}</p>}
              <div className="mt-4 border-t border-cream/10 pt-3 font-mono text-xs text-cream/50">
                {c.moduleCount} modules
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats band */}
      <div className="mx-auto max-w-4xl border-y border-cream/12 px-6 py-14">
        <div className="grid grid-cols-2 gap-9 sm:grid-cols-4">
          <Stat value={String(campuses.length)} label="Campuses" />
          <Stat value={String(totalModules)} label="Modules" />
          <Stat value={String(schools.length || 2)} label="Schools" />
          <Stat value="300M+" label="Views delivered by the founder" />
        </div>
      </div>

      {/* How it works */}
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <Caption>How it works</Caption>
        <h2 className="mt-5 max-w-[16ch] font-display text-[32px] leading-[1.05] tracking-[-0.01em] text-cream-bright sm:text-[44px]">
          What a module looks like.
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((st) => (
            <div key={st.num} className="border-t-2 border-gold/60 pt-6">
              <div className="font-mono text-xs text-gold/80">{st.num}</div>
              <div className="mt-4 font-display text-lg text-cream-bright">{st.title}</div>
              <div className="mt-3 text-sm leading-[1.6] text-cream/68">{st.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Track record */}
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
        <Caption>The track record</Caption>
        <h2 className="mt-5 max-w-[18ch] font-display text-[32px] leading-[1.05] tracking-[-0.01em] text-cream-bright sm:text-[44px]">
          Real campaigns, real numbers.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {CASE_STUDIES.map((cs) => (
            <div key={cs.client} className="border border-cream/10 p-6">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl text-cream-bright">{cs.client}</span>
                <span className="font-mono text-xs text-gold">{cs.stat}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-[0.1em] text-cream/45 uppercase">
                {cs.vertical} — {cs.statLabel}
              </div>
              <p className="mt-4 text-sm leading-[1.6] text-cream/68">{cs.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="border-t border-cream/12">
        <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
          <Caption>Enrolment</Caption>
          <h2 className="mt-5 max-w-[14ch] font-display text-[36px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[52px]">
            Pick a school and start wherever you like.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href="/join"
              className="rounded-[2px] border border-gold bg-gold px-7 py-3.5 font-body text-sm font-semibold tracking-[0.02em] text-ink transition-colors hover:bg-gold-bright"
            >
              Enter École →
            </Link>
            <span className="font-mono text-xs tracking-[0.04em] text-cream/55 uppercase">
              Founders and artists · {campuses.length} campuses · Cancel anytime
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureBlock({
  num,
  glyph,
  title,
  body,
  points,
}: {
  num: string;
  glyph: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span
          className="font-display text-4xl"
          style={{ color: "transparent", WebkitTextStroke: "1.5px rgba(217,176,99,0.55)" }}
        >
          {num}
        </span>
        <Stamp campusSlug={glyph} earned size={40} />
      </div>
      <h3 className="mt-5 font-display text-2xl text-cream-bright sm:text-3xl">{title}</h3>
      <p className="mt-4 max-w-[52ch] text-base leading-[1.65] text-cream/68">{body}</p>
      <div className="mt-5 flex flex-col gap-2.5">
        {points.map((p) => (
          <div key={p} className="flex items-start gap-3">
            <span className="mt-0.5 font-mono text-xs text-gold">→</span>
            <span className="text-sm leading-[1.5] text-cream/80">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-4xl text-gold-bright sm:text-5xl">{value}</div>
      <div className="mt-2.5 font-mono text-[11px] tracking-[0.1em] text-cream/58 uppercase">{label}</div>
    </div>
  );
}
