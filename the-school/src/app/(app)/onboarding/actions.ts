"use server";
/**
 * Onboarding server action: records the school choice. Member creation
 * itself lives in lib/member.ts so checkout can lazily create one too.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function chooseSchool(schoolSlug: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const member = await db.member.findUnique({ where: { clerkUserId: userId } });
  if (!member) redirect("/onboarding");

  const school = await db.school.findUnique({ where: { slug: schoolSlug } });
  if (school) {
    await db.member.update({ where: { id: member.id }, data: { schoolId: school.id } });
  }
  redirect("/onboarding");
}
