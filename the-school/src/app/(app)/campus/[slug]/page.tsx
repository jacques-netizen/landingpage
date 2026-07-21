/**
 * Campus page: linear core (modules in order) + library shelf.
 * Lens filtering comes from the member's school link — same campus renders
 * founder or artist content automatically. Nothing curriculum-specific here.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess, isCampusUnlocked, lensMatches } from "@/lib/access";

export default async function CampusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const member = await getMemberByClerkId(userId);
  if (!member || !hasActiveAccess(member) || !member.schoolId) redirect("/dashboard");

  const campus = await db.campus.findUnique({
    where: { slug },
    include: {
      modules: { where: { archived: false }, orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } }, assignment: true } },
      shelf: { where: { archived: false }, orderBy: { order: "asc" } },
      schools: { where: { schoolId: member.schoolId } },
    },
  });
  if (!campus || campus.schools.length === 0) notFound();
  if (!(await isCampusUnlocked(member.id, member.schoolId, campus.id))) redirect("/dashboard");

  const schoolLens = campus.schools[0].lens;
  const progress = await db.moduleProgress.findMany({ where: { memberId: member.id, moduleId: { in: campus.modules.map((m) => m.id) } } });
  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.moduleId));

  const visibleModules = campus.modules.filter((m) => lensMatches((m.meta as { lens?: string })?.lens, schoolLens));
  const visibleShelf = campus.shelf.filter((s) => lensMatches(s.lens, schoolLens));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{campus.name}</h1>
      {campus.promise && <p className="mt-2 opacity-70">{campus.promise}</p>}
      {campus.fastWin && <p className="mt-4 rounded-lg bg-neutral-100 p-4 text-sm"><strong>The win:</strong> {campus.fastWin}</p>}

      <h2 className="mt-10 text-xl font-medium">Linear core</h2>
      <ol className="mt-4 space-y-2">
        {visibleModules.map((m) => {
          const firstLesson = m.lessons.find((l) => lensMatches(l.lens, schoolLens));
          return (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border p-4">
              <span className={done.has(m.id) ? "text-green-600" : "opacity-30"}>●</span>
              <div className="flex-1">
                {firstLesson ? (
                  <Link href={`/lesson/${firstLesson.slug}`} className="font-medium hover:underline">{m.title}</Link>
                ) : (
                  <span className="font-medium">{m.title}</span>
                )}
                {m.summary && <p className="text-sm opacity-70">{m.summary}</p>}
              </div>
              {m.isBlocker && <span className="text-xs uppercase tracking-wide opacity-50">blocker</span>}
            </li>
          );
        })}
      </ol>

      {visibleShelf.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-medium">Library shelf</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {visibleShelf.map((s) => (
              <li key={s.id} className="rounded-lg border p-4 text-sm">
                {s.url ? <a href={s.url} className="font-medium hover:underline">{s.title}</a> : <span className="font-medium">{s.title}</span>}
                <span className="ml-2 text-xs uppercase opacity-50">{s.kind}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
