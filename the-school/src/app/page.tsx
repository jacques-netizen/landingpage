/**
 * Data loader only — see LandingView.tsx for the presentation. Campus/school
 * names, taglines, promises and counts are pulled from the DB (Rule 0: even
 * the marketing copy shouldn't drift from what's actually seeded).
 */
import { db } from "@/lib/db";
import { LandingView } from "./LandingView";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [schools, campuses] = await Promise.all([
    db.school.findMany({
      where: { archived: false },
      orderBy: { order: "asc" },
      select: { slug: true, name: true, tagline: true },
    }),
    db.campus.findMany({
      where: { archived: false },
      orderBy: { order: "asc" },
      include: { modules: { where: { archived: false }, select: { id: true } } },
    }),
  ]);

  const totalModules = campuses.reduce((a, c) => a + c.modules.length, 0);

  return (
    <LandingView
      schools={schools}
      campuses={campuses.map((c) => ({
        slug: c.slug,
        name: c.name,
        promise: c.promise,
        moduleCount: c.modules.length,
      }))}
      totalModules={totalModules}
    />
  );
}
