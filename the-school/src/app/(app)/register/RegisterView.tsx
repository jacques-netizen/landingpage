/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch. This is the signature screen (design study §3/§6):
 * the stamp wall. Every campus is open — no locked state.
 */
import Link from "next/link";
import { Caption } from "@/components/Caption";
import { Stamp } from "@/components/Stamp";
import { toRoman } from "@/lib/roman";
import { accentTextClass } from "@/lib/wing";

export type RegisterModule = {
  slug: string;
  lessonSlug: string | null;
  name: string;
  earned: boolean;
  isBlocker: boolean;
};

export type RegisterCampus = {
  slug: string;
  name: string;
  subtitle: string | null;
  modules: RegisterModule[];
};

export function RegisterView({
  schoolName,
  schoolSlug,
  campuses,
  totalEarned,
  totalModules,
  tier,
}: {
  schoolName: string;
  schoolSlug: string | null;
  campuses: RegisterCampus[];
  totalEarned: number;
  totalModules: number;
  tier: string;
}) {
  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-11">
        <div className="relative">
          <div
            className="pointer-events-none absolute -top-16 right-0 select-none font-display leading-[0.8]"
            style={{
              fontSize: "clamp(120px, 20vw, 280px)",
              color: "transparent",
              WebkitTextStroke: "1.5px rgba(217,176,99,0.26)",
            }}
          >
            {totalEarned}
          </div>
          <div className="relative">
            <Caption className={accentTextClass(schoolSlug)}>{schoolName} — The Register</Caption>
            <h1 className="mt-3.5 max-w-[12ch] font-display text-[44px] leading-[0.94] tracking-[-0.01em] text-cream-bright sm:text-[64px] md:text-[80px]">
              Everything you have shipped.
            </h1>
          </div>
        </div>
        <p className="mt-6 max-w-[52ch] text-base leading-[1.6] text-cream/68">
          {totalEarned} of {totalModules} modules pressed into the record. Standing: {tier}.
        </p>

        <div className="mt-16 flex flex-col gap-12">
          {campuses.map((c, idx) => (
            <div key={c.slug} className="border-t border-cream/14 pt-9">
              <div className="flex gap-6 sm:gap-9">
                <div
                  className="hidden w-[72px] flex-shrink-0 font-display text-[52px] leading-none sm:block"
                  style={{ color: "transparent", WebkitTextStroke: "1.5px rgba(237,230,214,0.4)" }}
                >
                  {toRoman(idx + 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-6 flex items-baseline justify-between gap-4">
                    <div>
                      {c.subtitle && <Caption>{c.subtitle}</Caption>}
                      <div className="mt-0.5 font-display text-[30px] leading-[1.02] text-cream-bright sm:text-[38px] md:text-[46px]">
                        {c.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-6">
                    {c.modules.map((m) => (
                      <Link
                        key={m.slug}
                        href={m.lessonSlug ? `/lesson/${m.lessonSlug}` : `/campus/${c.slug}`}
                        className="flex w-[74px] flex-col items-center gap-2.5 transition-transform hover:-translate-y-1"
                      >
                        <Stamp campusSlug={c.slug} earned={m.earned} size={64} />
                        <div
                          className={`text-center font-mono text-[9px] leading-[1.3] tracking-[0.02em] text-cream/55 ${m.isBlocker ? "italic" : ""}`}
                        >
                          {m.name}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
