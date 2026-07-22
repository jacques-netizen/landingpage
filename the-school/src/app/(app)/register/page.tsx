/**
 * Data loader only — see RegisterView.tsx for the presentation. The
 * signature screen: every shipped stamp, across every open campus.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess, lensMatches } from "@/lib/access";
import { getStampedModuleIds, tierName } from "@/lib/stamps";
import { RegisterView } from "./RegisterView";

export default async function RegisterPage() {
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
      campus: {
        include: {
          modules: {
            where: { archived: false },
            orderBy: { order: "asc" },
            include: { lessons: { orderBy: { order: "asc" } } },
          },
        },
      },
      school: true,
    },
  });

  const allModuleIds = links.flatMap((l) => l.campus.modules.map((m) => m.id));
  const stamped = await getStampedModuleIds(member.id, allModuleIds);

  const campuses = links.map((l) => {
    const visibleModules = l.campus.modules.filter((m) => lensMatches((m.meta as { lens?: string })?.lens, l.lens));
    return {
      slug: l.campus.slug,
      name: l.campus.name,
      subtitle: (l.campus.meta as { sharedSpine?: boolean })?.sharedSpine ? "Shared" : null,
      modules: visibleModules.map((m) => ({
        slug: m.slug,
        lessonSlug: m.lessons.find((lesson) => lensMatches(lesson.lens, l.lens))?.slug ?? null,
        name: m.title,
        earned: stamped.has(m.id),
        isBlocker: m.isBlocker,
      })),
    };
  });

  const totalEarned = campuses.reduce((a, c) => a + c.modules.filter((m) => m.earned).length, 0);
  const totalModules = campuses.reduce((a, c) => a + c.modules.length, 0);

  return (
    <RegisterView
      schoolName={links[0]?.school.name ?? ""}
      schoolSlug={member.school?.slug ?? null}
      campuses={campuses}
      totalEarned={totalEarned}
      totalModules={totalModules}
      tier={tierName(totalEarned)}
    />
  );
}
