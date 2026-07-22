/**
 * Data loader only — see CampusView.tsx for the presentation. Every campus
 * is open to every active member (no sequential gating). Lens filtering
 * comes from the member's school link — same campus renders founder or
 * artist content automatically. Nothing curriculum-specific here.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess, lensMatches } from "@/lib/access";
import { getStampedModuleIds } from "@/lib/stamps";
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
      modules: { where: { archived: false }, orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } },
      shelf: { where: { archived: false }, orderBy: { order: "asc" } },
      schools: { where: { schoolId: member.schoolId } },
    },
  });
  if (!campus || campus.schools.length === 0) notFound();

  const schoolLens = campus.schools[0].lens;
  const stamped = await getStampedModuleIds(member.id, campus.modules.map((m) => m.id));

  const visibleModules = campus.modules.filter((m) => lensMatches((m.meta as { lens?: string })?.lens, schoolLens));
  const visibleShelf = campus.shelf.filter((s) => lensMatches(s.lens, schoolLens));

  return (
    <CampusView
      slug={campus.slug}
      name={campus.name}
      promise={campus.promise}
      fastWin={campus.fastWin}
      modules={visibleModules.map((m) => ({
        id: m.id,
        title: m.title,
        summary: m.summary,
        isBlocker: m.isBlocker,
        earned: stamped.has(m.id),
        lessonSlug: m.lessons.find((l) => lensMatches(l.lens, schoolLens))?.slug ?? null,
      }))}
      shelf={visibleShelf.map((s) => ({ id: s.id, title: s.title, kind: s.kind, url: s.url }))}
    />
  );
}
