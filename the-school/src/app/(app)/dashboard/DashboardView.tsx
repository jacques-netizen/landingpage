/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch (Rule 0/1) and never needs to change when the look
 * does. Adapts the École "Dashboard" screen (design study §6): campuses as
 * a plan of the house. Every campus is open — no locked state.
 */
import Link from "next/link";
import { Caption } from "@/components/Caption";
import { Stamp } from "@/components/Stamp";
import { toRoman } from "@/lib/roman";
import { accentTextClass } from "@/lib/wing";

export type DashboardCampus = {
  slug: string;
  name: string;
  subtitle: string | null;
  moduleCount: number;
  earnedCount: number;
};

export function DashboardView({
  schoolName,
  schoolSlug,
  discordConnected,
  campuses,
}: {
  schoolName: string;
  schoolSlug: string | null;
  discordConnected: boolean;
  campuses: DashboardCampus[];
}) {
  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-11">
        <Caption className={accentTextClass(schoolSlug)}>{schoolName}</Caption>
        <h1 className="mt-3.5 max-w-[11ch] font-display text-[44px] leading-[0.94] tracking-[-0.01em] text-cream-bright sm:text-[64px] md:text-[84px]">
          Your campuses.
        </h1>
        <p className="mt-6 max-w-[52ch] text-base leading-[1.6] text-cream/68">
          {campuses.length} campuses. Any order.
        </p>

        {!discordConnected && (
          <a
            href="/api/discord/connect"
            className="mt-8 block rounded-[2px] border border-dashed border-cream/25 p-4 text-sm text-cream/70 transition-colors hover:border-cream/45 hover:text-cream-bright"
          >
            Connect Discord to get your member role →
          </a>
        )}

        <div className="mt-14">
          {campuses.map((c, i) => {
            const complete = c.moduleCount > 0 && c.earnedCount === c.moduleCount;
            const statusLabel = complete ? "Complete" : c.earnedCount > 0 ? `In progress · ${c.earnedCount}/${c.moduleCount}` : "Open";
            return (
              <Link
                key={c.slug}
                href={`/campus/${c.slug}`}
                className="flex items-center gap-5 border-t border-cream/12 py-7 transition-transform hover:translate-x-2 sm:gap-6"
              >
                <div
                  className="w-11 flex-shrink-0 font-display text-[30px] leading-none sm:w-16 sm:text-[38px]"
                  style={{
                    color: "transparent",
                    WebkitTextStroke: complete ? "1.5px rgba(217,176,99,0.7)" : "1.5px rgba(237,230,214,0.4)",
                  }}
                >
                  {toRoman(i + 1)}
                </div>
                <Stamp campusSlug={c.slug} earned={complete} size={56} />
                <div className="min-w-0 flex-1">
                  {c.subtitle && <Caption>{c.subtitle}</Caption>}
                  <div className="font-display text-[22px] leading-[1.1] text-cream-bright sm:text-[32px] md:text-[38px]">
                    {c.name}
                  </div>
                </div>
                <div className="hidden w-28 flex-shrink-0 text-right font-mono text-xs text-cream/45 sm:block">
                  {c.moduleCount} modules
                </div>
                <div className="w-auto flex-shrink-0 text-right font-mono text-xs text-cream/60 sm:w-56">
                  {statusLabel}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
