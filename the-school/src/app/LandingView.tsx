/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch (Rule 0: school names/taglines come from the DB) and
 * never needs to change when the look does.
 *
 * Adapts the École "Cover" screen (design study §6) for the public,
 * signed-out marketing page.
 */
import Link from "next/link";
import { Caption } from "@/components/Caption";

export type LandingSchool = { slug: string; name: string; tagline: string | null };

export function LandingView({ schools }: { schools: LandingSchool[] }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink pt-[76px]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1300px 820px at 72% -6%, rgba(217,176,99,0.13), transparent 56%), radial-gradient(1100px 900px at 6% 108%, rgba(217,176,99,0.07), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <Caption>The School</Caption>
        <h1 className="mt-6 max-w-[14ch] font-display text-[44px] leading-[0.96] tracking-[-0.01em] text-cream-bright sm:text-[72px] md:text-[92px]">
          Nothing shipped is invisible here.
        </h1>
        <p className="mt-8 max-w-[46ch] text-base leading-[1.65] text-cream/72">
          A register, not a course library. Pick your wing, work the curriculum
          in whatever order suits you, and ship real work — each shipped
          assignment presses into the record in gold.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/join"
            className="rounded-[2px] border border-cream-bright/50 px-7 py-3.5 font-body text-sm font-semibold tracking-[0.04em] text-cream-bright transition-colors hover:border-cream-bright hover:bg-cream-bright hover:text-ink"
          >
            Join École →
          </Link>
          <Link
            href="/sign-in"
            className="rounded-[2px] border border-cream/20 px-7 py-3.5 font-body text-sm font-semibold tracking-[0.04em] text-cream/80 transition-colors hover:border-cream/40"
          >
            Sign in
          </Link>
        </div>

        {schools.length > 0 && (
          <div className="mt-24 grid gap-4 sm:grid-cols-2">
            {schools.map((school) => (
              <div key={school.slug} className="border-t border-cream/14 pt-6">
                <Caption>The School for</Caption>
                <h2 className="mt-2 font-display text-[28px] leading-[1.05] text-cream-bright">{school.name}</h2>
                {school.tagline && <p className="mt-2 text-sm text-cream/68">{school.tagline}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
