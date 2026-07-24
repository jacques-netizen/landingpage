"use client";
/**
 * The public marketing page. Client component because the hero runs a video
 * with mouse parallax, the nav-chrome carries live world clocks, stats count
 * up on scroll, and sections reveal on entry.
 *
 * Data (schools, campuses, counts) is fetched in page.tsx and passed as
 * props (Rule 0 — names/counts come from the DB). Case-study numbers are the
 * founder's real Maison d'Élites track record, not curriculum, so they're
 * static here. Copy follows the writing-voice guide: plain, numeric, no
 * locked-campus language, no invented testimonials.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Caption } from "@/components/Caption";
import { Stamp } from "@/components/Stamp";
import { toRoman } from "@/lib/roman";

export type LandingSchool = { slug: string; name: string; tagline: string | null };
export type LandingCampus = { slug: string; name: string; promise: string | null; moduleCount: number };

const FEATURES = [
  {
    num: "01",
    glyph: "foundation",
    title: "A register, not a transcript.",
    body: "Every module ends in an assignment you produce and file. Ship it and it becomes a stamp on your register.",
    points: ["Ship an assignment, earn a stamp", "Every stamp is dated and campus-marked", "Work any campus in any order"],
  },
  {
    num: "02",
    glyph: "linkedin",
    title: "Two schools, one spine.",
    body: "Founders and artists study the same operating spine: outreach, distribution, systems. Shared campuses adapt to the school you're in.",
    points: ["Founders: cold outreach, LinkedIn, CRM", "Artists: content, distribution, brand deals", "Shared: IG organic, YouTube, short-form"],
  },
  {
    num: "03",
    glyph: "crm",
    title: "Taught by the operator.",
    body: "Jacques Amoako runs Maison d'Élites. 300M+ views delivered, 80+ brand partnerships, campaigns for Walmart and the Paul American launch.",
    points: ["17M views on the Walmart campaign", "42.2M views on a 90-day amplification", "200M views a month on the Capital Club"],
  },
];

const STEPS = [
  { num: "01", title: "Pick your school", body: "Founders or artists. Every campus is open from day one." },
  { num: "02", title: "Work the module", body: "Watch the lesson. Produce the artifact it asks for." },
  { num: "03", title: "Ship and stamp", body: "File the work. It becomes a stamp on your register." },
];

const CASE_STUDIES = [
  { client: "Walmart", vertical: "Retail", stat: "17M", statLabel: "views", detail: "Creator-led retail campaign. 0.2% conversion, roughly 34,000 actions driven.", glyph: "distribution" },
  { client: "Paul American", vertical: "Personal brand", stat: "11.2M", statLabel: "views", detail: "Clipping campaign for the reality launch. 6,141 submissions, 216 approved creators, $1.78 CPM.", glyph: "ig" },
  { client: "Capital Club", vertical: "Entrepreneurship", stat: "200M", statLabel: "views / month", detail: "Ambassador program driving referrals. $19M in referred revenue, 7,781 referrals.", glyph: "youtube" },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("in");
      },
      { threshold: 0.15 },
    );
    el.querySelectorAll(".reveal").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

function CountUp({ target, suffix = "", duration = 1400 }: { target: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !done.current) {
        done.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(eased * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);
  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

function useClock(timeZone: string) {
  const [t, setT] = useState("");
  useEffect(() => {
    const fmt = () => {
      try {
        return new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone,
        }).format(new Date());
      } catch {
        return "";
      }
    };
    setT(fmt());
    const id = setInterval(() => setT(fmt()), 1000);
    return () => clearInterval(id);
  }, [timeZone]);
  return t;
}

export function LandingView({
  schools,
  campuses,
  totalModules,
}: {
  schools: LandingSchool[];
  campuses: LandingCampus[];
  totalModules: number;
}) {
  const root = useReveal();
  const atmosRef = useRef<HTMLDivElement>(null);
  const paris = useClock("Europe/Paris");
  const accra = useClock("Africa/Accra");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      const el = atmosRef.current;
      if (!el) return;
      const dx = (e.clientX / window.innerWidth - 0.5) * -18;
      const dy = (e.clientY / window.innerHeight - 0.5) * -14;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={root} className="relative overflow-x-hidden bg-ink text-cream">
      {/* grain */}
      <div
        className="pointer-events-none fixed inset-0 z-[200] opacity-[0.05] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')",
        }}
      />

      {/* ===== HERO ===== */}
      <section className="relative h-screen min-h-[640px] overflow-hidden">
        <div ref={atmosRef} className="absolute inset-[-4%] z-0 will-change-transform">
          <div className="ken-burns absolute inset-0" style={{ background: "linear-gradient(158deg,#2b3327 0%,#191d18 52%,#0b0d0b 100%)" }}>
            <video autoPlay loop muted playsInline className="h-full w-full object-cover" poster="">
              <source src="/hero-atmosphere.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(90deg, rgba(13,15,13,0.92) 0%, rgba(13,15,13,0.55) 38%, rgba(13,15,13,0.14) 66%, transparent 100%), radial-gradient(1100px 720px at 78% 92%, rgba(201,162,75,0.16), transparent 62%), linear-gradient(180deg, rgba(13,15,13,0.5) 0%, rgba(13,15,13,0.1) 34%, rgba(13,15,13,0.3) 72%, rgba(13,15,13,0.94) 100%)",
          }}
        />
        <div className="relative z-[3] flex h-full flex-col justify-center px-6 sm:px-11">
          <div className="fade-up max-w-[15ch]">
            <div className="mb-7 flex items-center gap-3.5">
              <span className="h-px w-8 bg-cream/50" />
              <span className="font-mono text-[11px] tracking-[0.28em] text-cream-bright/85 uppercase">École · founders and artists</span>
            </div>
            <h1 className="font-display text-[46px] leading-[0.94] tracking-[-0.015em] text-cream-bright sm:text-[88px] md:text-[120px]" style={{ textShadow: "0 2px 40px rgba(0,0,0,0.6)" }}>
              Every module ends
              <br />
              in something you <span className="text-gold-bright italic">ship.</span>
            </h1>
            <p className="mt-8 max-w-[46ch] text-[15px] leading-[1.65] text-cream/84 sm:text-lg" style={{ textShadow: "0 1px 22px rgba(0,0,0,0.55)" }}>
              A register, not a course library. Two schools, founders and artists. {campuses.length} campuses,{" "}
              {totalModules} modules.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link href="/join" className="rounded-[2px] bg-gold px-8 py-4 font-body text-[15px] font-bold tracking-[0.02em] text-ink transition-[background,transform] hover:-translate-y-px hover:bg-gold-bright">
                Enter École →
              </Link>
              <span className="font-mono text-[11px] tracking-[0.06em] text-cream/80">
                Built on 300M+ views delivered
              </span>
            </div>
          </div>
        </div>
        {/* bottom chrome */}
        <div className="absolute inset-x-0 bottom-0 z-[3] flex h-[62px] items-center justify-between px-6 font-mono text-[11px] tracking-[0.14em] text-cream/72 uppercase sm:px-11">
          <div>© 2026 École</div>
          <div className="hidden items-center gap-8 md:flex">
            <span>{paris} · Paris FR</span>
            <span>{accra} · Accra GH</span>
          </div>
          <a href="#method" className="flex items-center gap-2">
            <span>Scroll</span>
            <span className="scroll-cue inline-block">↓</span>
          </a>
        </div>
      </section>

      {/* ===== METHOD / MANIFESTO ===== */}
      <section id="method" className="mx-auto max-w-6xl px-6 py-24 sm:px-11 sm:py-32">
        <div className="reveal">
          <Caption>The method</Caption>
          <h2 className="mt-5 max-w-[15ch] font-display text-[34px] leading-[1.02] tracking-[-0.01em] text-cream-bright sm:text-[56px]">
            You graduate by shipping.
          </h2>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 sm:gap-16">
          <p className="reveal text-[17px] leading-[1.75] text-cream/70">
            Most course libraries measure hours watched. You finish with a shelf of completed videos and nothing that
            exists outside the player.
          </p>
          <p className="reveal text-[17px] leading-[1.75] text-cream/70">
            École measures shipped work. Ship an assignment, earn a <span className="text-gold-bright">stamp</span>.
            Every campus is open from day one. Work in whatever order fits what you're building this week.
          </p>
        </div>
      </section>

      {/* ===== FEATURE BLOCKS ===== */}
      <section className="mx-auto flex max-w-6xl flex-col gap-24 px-6 sm:gap-36 sm:px-11">
        {FEATURES.map((f, i) => (
          <div key={f.num} className={`reveal flex flex-col items-stretch gap-8 sm:gap-16 ${i % 2 === 1 ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
            <div className="flex-1">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[4px] border border-gold/16" style={{ background: "radial-gradient(120% 120% at 30% 20%, #1a1f16 0%, #0f120e 70%)" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Stamp campusSlug={f.glyph} earned size={160} />
                </div>
                <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(13,15,13,0.6) 100%)" }} />
                <div className="absolute top-4 left-4 font-mono text-[10px] tracking-[0.14em] text-cream/45 uppercase">Fig. {f.num}</div>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <div className="mb-5 flex items-center gap-4">
                <span className="font-display text-4xl sm:text-6xl" style={{ color: "transparent", WebkitTextStroke: "1.5px rgba(201,162,75,0.55)" }}>{f.num}</span>
                <Stamp campusSlug={f.glyph} earned size={44} />
              </div>
              <h3 className="font-body text-[22px] font-extrabold tracking-[0.01em] text-cream-bright uppercase sm:text-[32px]">{f.title}</h3>
              <p className="mt-4 max-w-[46ch] text-base leading-[1.7] text-cream/70">{f.body}</p>
              <div className="mt-6 flex flex-col gap-3">
                {f.points.map((p) => (
                  <div key={p} className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-[13px] text-gold">→</span>
                    <span className="text-[15px] leading-[1.5] text-cream/82">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ===== CAMPUS GRID ===== */}
      <section id="campuses" className="mx-auto max-w-6xl px-6 pt-24 sm:px-11 sm:pt-36">
        <div className="reveal text-center">
          <Caption>The curriculum</Caption>
          <h2 className="mt-5 font-display text-[34px] leading-[1.02] tracking-[-0.01em] text-cream-bright sm:text-[56px]">What you build.</h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-base leading-[1.65] text-cream/68">
            {campuses.length} campuses. Work them in any order.
          </p>
        </div>
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campuses.map((c, i) => (
            <div
              key={c.slug}
              className="reveal flex flex-col rounded-[4px] border border-cream/12 p-7 transition-[border-color,transform] hover:-translate-y-1 hover:border-gold/50"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008))" }}
            >
              <div className="flex items-center justify-between">
                <Stamp campusSlug={c.slug} earned size={54} />
                <span className="font-mono text-[11px] tracking-[0.1em] text-cream/40">{toRoman(i + 1)}</span>
              </div>
              <div className="mt-6 font-display text-2xl text-cream-bright">{c.name}</div>
              {c.promise && <p className="mt-3 text-sm leading-[1.6] text-cream/62">{c.promise}</p>}
              <div className="mt-6 border-t border-cream/10 pt-4 font-mono text-[11px] tracking-[0.06em] text-cream/50">
                {c.moduleCount} modules
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== STATS BAND ===== */}
      <section className="mx-auto mt-24 max-w-6xl border-y border-cream/12 px-6 py-14 sm:mt-36 sm:px-11">
        <div className="grid grid-cols-2 gap-9 sm:grid-cols-4">
          <StatCounter value={campuses.length} label="Campuses" />
          <StatCounter value={totalModules} label="Modules" />
          <StatCounter value={schools.length || 2} label="Schools" />
          <div>
            <div className="font-display text-[42px] leading-none text-gold-bright sm:text-[64px]">
              <CountUp target={300} suffix="M+" />
            </div>
            <div className="mt-3 font-mono text-[11px] tracking-[0.12em] text-cream/55 uppercase">Views delivered</div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24 sm:px-11 sm:py-36">
        <div className="reveal">
          <Caption>How it works</Caption>
          <h2 className="mt-5 max-w-[16ch] font-display text-[34px] leading-[1.02] tracking-[-0.01em] text-cream-bright sm:text-[56px]">
            What a module looks like.
          </h2>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-12">
          {STEPS.map((st) => (
            <div key={st.num} className="reveal border-t-2 border-gold/60 pt-6">
              <div className="font-mono text-xs tracking-[0.1em] text-gold/80">{st.num}</div>
              <div className="mt-4 font-body text-xl font-extrabold tracking-[0.01em] text-cream-bright uppercase">{st.title}</div>
              <div className="mt-4 text-[15px] leading-[1.7] text-cream/68">{st.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TRACK RECORD ===== */}
      <section id="track" className="mx-auto max-w-6xl px-6 pb-24 sm:px-11 sm:pb-36">
        <div className="reveal text-center">
          <Caption>The track record</Caption>
          <h2 className="mt-5 font-display text-[34px] leading-[1.02] tracking-[-0.01em] text-cream-bright sm:text-[56px]">
            Real campaigns, real numbers.
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-base text-cream/68">
            The founder's work at Maison d'Élites. This is who teaches the distribution campuses.
          </p>
        </div>
        <div className="mt-16 grid gap-5 sm:grid-cols-3">
          {CASE_STUDIES.map((cs) => (
            <div key={cs.client} className="reveal overflow-hidden rounded-[4px] border border-cream/10" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.006))" }}>
              <div className="relative aspect-[16/10] overflow-hidden" style={{ background: "radial-gradient(120% 120% at 70% 20%, #1a1f16 0%, #0f120e 72%)" }}>
                <div className="absolute inset-0 flex items-center justify-center opacity-90">
                  <Stamp campusSlug={cs.glyph} earned size={110} />
                </div>
                <div className="absolute bottom-4 left-5">
                  <div className="font-display text-[40px] leading-none text-gold-bright">{cs.stat}</div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-cream/60 uppercase">{cs.statLabel}</div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl text-cream-bright">{cs.client}</span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-cream/45 uppercase">{cs.vertical}</span>
                </div>
                <p className="mt-4 text-sm leading-[1.6] text-cream/68">{cs.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="relative flex min-h-[80vh] items-center overflow-hidden border-t border-cream/12">
        <div className="absolute inset-0 z-0" style={{ background: "linear-gradient(158deg,#2b3327 0%,#191d18 52%,#0b0d0b 100%)" }}>
          <video autoPlay loop muted playsInline className="h-full w-full object-cover opacity-60">
            <source src="/hero-atmosphere.mp4" type="video/mp4" />
          </video>
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(900px 600px at 30% 60%, rgba(201,162,75,0.22), transparent 60%), linear-gradient(180deg, rgba(13,15,13,0.9) 0%, rgba(13,15,13,0.55) 45%, rgba(13,15,13,0.95) 100%)",
          }}
        />
        <div className="relative z-[2] mx-auto w-full max-w-6xl px-6 sm:px-11">
          <div className="reveal">
            <Caption>Enrolment</Caption>
            <h2 className="mt-5 max-w-[13ch] font-display text-[44px] leading-[0.94] tracking-[-0.015em] text-cream-bright sm:text-[88px]">
              Pick a school and start.
            </h2>
            <p className="mt-7 max-w-[46ch] text-[17px] leading-[1.7] text-cream/74">
              Every campus is open the moment you're in. Ship your first assignment this week.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link href="/join" className="rounded-[2px] bg-gold px-8 py-4 font-body text-[15px] font-bold tracking-[0.02em] text-ink transition-[background,transform] hover:-translate-y-px hover:bg-gold-bright">
                Enter École →
              </Link>
              <span className="font-mono text-[11px] tracking-[0.06em] text-cream/60">
                Founders and artists · {campuses.length} campuses · Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="flex flex-wrap items-center justify-between gap-7 border-t border-cream/12 px-6 py-14 sm:px-11">
        <Link href="/" className="flex items-baseline gap-0">
          <span className="font-display text-[28px] leading-[0.8] text-gold">É</span>
          <span className="font-display text-base text-cream-bright">cole</span>
        </Link>
        <div className="flex gap-7 font-mono text-[11px] tracking-[0.1em] text-cream/55 uppercase">
          <a href="#campuses" className="hover:text-cream-bright">Campuses</a>
          <a href="#how" className="hover:text-cream-bright">How it works</a>
          <a href="#track" className="hover:text-cream-bright">Track record</a>
        </div>
        <div className="font-mono text-[11px] tracking-[0.08em] text-cream/40">© 2026 École</div>
      </footer>
    </div>
  );
}

function StatCounter({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-[42px] leading-none text-gold-bright sm:text-[64px]">
        <CountUp target={value} />
      </div>
      <div className="mt-3 font-mono text-[11px] tracking-[0.12em] text-cream/55 uppercase">{label}</div>
    </div>
  );
}
