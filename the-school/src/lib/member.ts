/**
 * Lazily creates the Member row on first touch. Clerk owns identity; the
 * spine reads access from this DB row, never Clerk/Stripe directly (Rule 1),
 * so every entry point that needs a Member (onboarding, checkout) goes
 * through here instead of assuming one already exists.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";
import { emitEvent } from "./events";

export async function ensureMember() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.member.findUnique({ where: { clerkUserId: userId } });
  if (existing) return existing;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? `${userId}@unknown.local`;
  const member = await db.member.create({
    data: { clerkUserId: userId, email, name: user?.fullName ?? undefined },
  });
  await emitEvent(member.id, "joined", {});
  return member;
}
