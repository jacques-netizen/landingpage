/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch and lens filtering (Rule 0). Every module is open —
 * no locked state; numbering is legitimate here since order carries
 * information (design study §6).
 */
import Link from "next/link";
import { Caption } from "@/components/Caption";
import { Stamp } from "@/components/Stamp";

export type CampusModule = {
  id: string;
  title: string;
  summary: string | null;
  isBlocker: boolean;
  earned: boolean;
  lessonSlug: string | null;
};

export type CampusShelfItem = {
  id: string;
  title: string;
  kind: string;
  url: string | null;
};

export function CampusView({
  slug,
  name,
  promise,
  fastWin,
  modules,
  shelf,
}: {
  slug: string;
  name: string;
  promise: string | null;
  fastWin: string | null;
  modules: CampusModule[];
  shelf: CampusShelfItem[];
}) {
  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-11">
        <h1 className="font-display text-[38px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[56px]">
          {name}
        </h1>
        {promise && <p className="mt-3 text-cream/70">{promise}</p>}
        {fastWin && (
          <div className="mt-6 rounded-[2px] border border-gold/22 border-t-2 border-t-gold bg-white/[0.035] p-5">
            <div className="font-mono text-[10px] tracking-[0.14em] text-gold/85 uppercase">Ships</div>
            <p className="mt-1.5 text-sm text-cream/90">{fastWin}</p>
          </div>
        )}

        <Caption className="mt-14">Linear core</Caption>
        <ol className="mt-4 flex flex-col">
          {modules.map((m, i) => (
            <li key={m.id} className="flex items-center gap-4 border-t border-cream/12 py-5 first:border-t-0">
              <span className="w-6 flex-shrink-0 font-mono text-xs text-cream/40">{String(i + 1).padStart(2, "0")}</span>
              <Stamp campusSlug={slug} earned={m.earned} size={40} />
              <div className="min-w-0 flex-1">
                {m.lessonSlug ? (
                  <Link href={`/lesson/${m.lessonSlug}`} className="font-display text-lg text-cream-bright hover:text-gold-bright">
                    {m.title}
                  </Link>
                ) : (
                  <span className="font-display text-lg text-cream-bright">{m.title}</span>
                )}
                {m.summary && <p className="mt-0.5 text-sm text-cream/60">{m.summary}</p>}
              </div>
              {m.isBlocker && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-cream/40">blocker</span>}
            </li>
          ))}
        </ol>

        {shelf.length > 0 && (
          <>
            <Caption className="mt-14">Library shelf</Caption>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {shelf.map((s) => (
                <li key={s.id} className="border border-cream/12 p-4 font-mono text-sm">
                  {s.url ? (
                    <a href={s.url} className="text-cream-bright hover:text-gold-bright">
                      {s.title}
                    </a>
                  ) : (
                    <span className="text-cream-bright">{s.title}</span>
                  )}
                  <span className="ml-2 text-[10px] uppercase text-cream/45">{s.kind}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
