/**
 * Member dashboard. 100% data-driven (CLAUDE.md Rule 0): renders whatever
 * the member's school contains — campuses, order, lock state all from DB.
 * No campus names, counts, or school assumptions in code.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess, isCampusUnlocked } from "@/lib/access";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const member = await getMemberByClerkId(userId);
  if (!member) redirect("/onboarding");
  if (!hasActiveAccess(member)) redirect("/join");
  if (!member.schoolId) redirect("/onboarding");

  const links = await db.campusOnSchool.findMany({
    where: { schoolId: member.schoolId, campus: { archived: false } },
    orderBy: { order: "asc" },
    include: { campus: true, school: true },
  });

  const unlocked = await Promise.all(
    links.map((l) => isCampusUnlocked(member.id, member.schoolId!, l.campusId))
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm uppercase tracking-widest opacity-60">{links[0]?.school.name}</p>
      <h1 className="mt-1 text-3xl font-semibold">Your campuses</h1>

      {!member.discordUserId && (
        <a
          href="/api/discord/connect"
          className="mt-6 block rounded-lg border border-dashed p-4 text-sm hover:bg-neutral-50"
        >
          Connect Discord to get your member role →
        </a>
      )}

      <ul className="mt-8 space-y-3">
        {links.map((l, i) => (
          <li key={l.campusId}>
            {unlocked[i] ? (
              <Link href={`/campus/${l.campus.slug}`} className="block rounded-lg border p-5 hover:bg-neutral-50">
                <span className="font-medium">{l.campus.name}</span>
                {l.campus.promise && <p className="mt-1 text-sm opacity-70">{l.campus.promise}</p>}
              </Link>
            ) : (
              <div className="block rounded-lg border border-dashed p-5 opacity-50">
                <span className="font-medium">{l.campus.name}</span>
                <p className="mt-1 text-sm">Locked — complete the campuses before it.</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
