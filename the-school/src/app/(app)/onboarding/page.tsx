/**
 * Data loader only — see SchoolPickerView.tsx / DiscordConnectView.tsx for
 * the presentation.
 */
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ensureMember } from "@/lib/member";
import { chooseSchool } from "./actions";
import { SchoolPickerView } from "./SchoolPickerView";
import { DiscordConnectView } from "./DiscordConnectView";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: "error" | "taken" }>;
}) {
  const { discord } = await searchParams;
  const member = await ensureMember();
  if (!member) redirect("/sign-in"); // middleware already protects this route; satisfies TS

  if (!member.schoolId) {
    const schools = await db.school.findMany({
      where: { archived: false },
      orderBy: { order: "asc" },
      select: { slug: true, name: true, tagline: true },
    });
    return <SchoolPickerView schools={schools} chooseSchoolAction={chooseSchool} />;
  }

  return <DiscordConnectView discordConnected={!!member.discordUserId} error={discord} />;
}
