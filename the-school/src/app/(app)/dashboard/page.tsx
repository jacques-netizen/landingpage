/**
 * Data loader + gating only — see DashboardView.tsx for the presentation.
 * 100% data-driven (CLAUDE.md Rule 0): renders whatever the member's school
 * contains — campuses, order, lock state all from DB.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess, isCampusUnlocked } from "@/lib/access";
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
    include: { campus: true, school: true },
  });

  const unlocked = await Promise.all(
    links.map((l) => isCampusUnlocked(member.id, member.schoolId!, l.campusId))
  );

  return (
    <DashboardView
      schoolName={links[0]?.school.name ?? ""}
      discordConnected={!!member.discordUserId}
      campuses={links.map((l, i) => ({
        slug: l.campus.slug,
        name: l.campus.name,
        promise: l.campus.promise,
        unlocked: unlocked[i],
      }))}
    />
  );
}
