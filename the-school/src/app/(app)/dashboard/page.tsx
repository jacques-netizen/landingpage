/**
 * Data loader only — see DashboardView.tsx for the presentation.
 * 100% data-driven (CLAUDE.md Rule 0): renders whatever the member's school
 * contains. Every campus is open — no sequential gating.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess } from "@/lib/access";
import { getStampedModuleIds } from "@/lib/stamps";
import { DashboardView } from "./DashboardView";

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
    include: {
      campus: { include: { modules: { where: { archived: false, isBlocker: false } } } },
      school: true,
    },
  });

  const allModuleIds = links.flatMap((l) => l.campus.modules.map((m) => m.id));
  const stamped = await getStampedModuleIds(member.id, allModuleIds);

  return (
    <DashboardView
      schoolName={links[0]?.school.name ?? ""}
      schoolSlug={member.school?.slug ?? null}
      discordConnected={!!member.discordUserId}
      campuses={links.map((l) => ({
        slug: l.campus.slug,
        name: l.campus.name,
        subtitle: (l.campus.meta as { sharedSpine?: boolean })?.sharedSpine ? "Shared" : null,
        moduleCount: l.campus.modules.length,
        earnedCount: l.campus.modules.filter((m) => stamped.has(m.id)).length,
      }))}
    />
  );
}
