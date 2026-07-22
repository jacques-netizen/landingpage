/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch and gating logic (Rule 0/1) and never needs to change
 * when the look does.
 */
import Link from "next/link";

export type DashboardCampus = {
  slug: string;
  name: string;
  promise: string | null;
  unlocked: boolean;
};

export function DashboardView({
  schoolName,
  discordConnected,
  campuses,
}: {
  schoolName: string;
  discordConnected: boolean;
  campuses: DashboardCampus[];
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm uppercase tracking-widest opacity-60">{schoolName}</p>
      <h1 className="mt-1 text-3xl font-semibold">Your campuses</h1>

      {!discordConnected && (
        <a
          href="/api/discord/connect"
          className="mt-6 block rounded-lg border border-dashed p-4 text-sm hover:bg-neutral-50"
        >
          Connect Discord to get your member role →
        </a>
      )}

      <ul className="mt-8 space-y-3">
        {campuses.map((c) => (
          <li key={c.slug}>
            {c.unlocked ? (
              <Link href={`/campus/${c.slug}`} className="block rounded-lg border p-5 hover:bg-neutral-50">
                <span className="font-medium">{c.name}</span>
                {c.promise && <p className="mt-1 text-sm opacity-70">{c.promise}</p>}
              </Link>
            ) : (
              <div className="block rounded-lg border border-dashed p-5 opacity-50">
                <span className="font-medium">{c.name}</span>
                <p className="mt-1 text-sm">Locked — complete the campuses before it.</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
