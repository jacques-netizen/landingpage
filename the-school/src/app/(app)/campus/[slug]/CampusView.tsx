/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch, unlock check, and lens filtering (Rule 0/1) and never
 * needs to change when the look does.
 */
import Link from "next/link";

export type CampusModule = {
  id: string;
  title: string;
  summary: string | null;
  isBlocker: boolean;
  completed: boolean;
  lessonSlug: string | null;
};

export type CampusShelfItem = {
  id: string;
  title: string;
  kind: string;
  url: string | null;
};

export function CampusView({
  name,
  promise,
  fastWin,
  modules,
  shelf,
}: {
  name: string;
  promise: string | null;
  fastWin: string | null;
  modules: CampusModule[];
  shelf: CampusShelfItem[];
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{name}</h1>
      {promise && <p className="mt-2 opacity-70">{promise}</p>}
      {fastWin && (
        <p className="mt-4 rounded-lg bg-neutral-100 p-4 text-sm">
          <strong>The win:</strong> {fastWin}
        </p>
      )}

      <h2 className="mt-10 text-xl font-medium">Linear core</h2>
      <ol className="mt-4 space-y-2">
        {modules.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg border p-4">
            <span className={m.completed ? "text-green-600" : "opacity-30"}>●</span>
            <div className="flex-1">
              {m.lessonSlug ? (
                <Link href={`/lesson/${m.lessonSlug}`} className="font-medium hover:underline">
                  {m.title}
                </Link>
              ) : (
                <span className="font-medium">{m.title}</span>
              )}
              {m.summary && <p className="text-sm opacity-70">{m.summary}</p>}
            </div>
            {m.isBlocker && <span className="text-xs uppercase tracking-wide opacity-50">blocker</span>}
          </li>
        ))}
      </ol>

      {shelf.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-medium">Library shelf</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {shelf.map((s) => (
              <li key={s.id} className="rounded-lg border p-4 text-sm">
                {s.url ? (
                  <a href={s.url} className="font-medium hover:underline">
                    {s.title}
                  </a>
                ) : (
                  <span className="font-medium">{s.title}</span>
                )}
                <span className="ml-2 text-xs uppercase opacity-50">{s.kind}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
