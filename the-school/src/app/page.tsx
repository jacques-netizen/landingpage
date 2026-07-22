/**
 * Data loader only — see LandingView.tsx for the presentation. School
 * names/taglines are pulled from the DB (Rule 0: even the pitch shouldn't
 * drift from what's actually seeded).
 */
import { db } from "@/lib/db";
import { LandingView } from "./LandingView";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const schools = await db.school.findMany({
    where: { archived: false },
    orderBy: { order: "asc" },
    select: { slug: true, name: true, tagline: true },
  });

  return <LandingView schools={schools} />;
}
