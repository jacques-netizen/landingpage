/**
 * Data loader + gating only — see CampusView.tsx for the presentation.
 * Lens filtering comes from the member's school link — same campus renders
 * founder or artist content automatically. Nothing curriculum-specific here.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess, isCampusUnlocked, lensMatches } from "@/lib/access";
import { CampusView } from "./CampusView";

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
    <CampusView
      name={campus.name}
      promise={campus.promise}
      fastWin={campus.fastWin}
      modules={visibleModules.map((m) => ({
        id: m.id,
        title: m.title,
        summary: m.summary,
        isBlocker: m.isBlocker,
        completed: done.has(m.id),
        lessonSlug: m.lessons.find((l) => lensMatches(l.lens, schoolLens))?.slug ?? null,
      }))}
      shelf={visibleShelf.map((s) => ({ id: s.id, title: s.title, kind: s.kind, url: s.url }))}
    />
  );
}
