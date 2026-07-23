/**
 * Manual access grant (comps, support unlocks, previewing without a real
 * checkout). Writes to the same Member.accessStatus field the Stripe
 * webhook writes to (Rule 1: access always reads from the DB), so the rest
 * of the spine — dashboard gating, Discord role sync — behaves identically
 * to a real paid member once this runs.
 *
 * If no Member row exists yet (they've verified with Clerk but never hit
 * /onboarding or /api/checkout, so the lazy-create never ran), this looks
 * the account up in Clerk by email and creates it — same as ensureMember(),
 * just triggered from here instead of a page visit.
 *
 * Gated by ADMIN_SECRET (set in Vercel env, never in code) rather than
 * Clerk session, so it can be called directly (support tooling, scripts).
 */
import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const { email, secret, plan, schoolSlug } = (await req.json()) as {
    email: string;
    secret: string;
    plan?: string;
    schoolSlug?: string;
  };

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let member = await db.member.findUnique({ where: { email } });

  if (!member) {
    const client = await clerkClient();
    const { data: users } = await client.users.getUserList({ emailAddress: [email] });
    const clerkUser = users[0];
    if (!clerkUser) return NextResponse.json({ error: "No Clerk account with that email — sign up first" }, { status: 404 });

    member = await db.member.create({
      data: {
        clerkUserId: clerkUser.id,
        email,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined,
      },
    });
    await emitEvent(member.id, "joined", { grantedBy: "admin" });
  }

  if (!member.schoolId && schoolSlug) {
    const school = await db.school.findUnique({ where: { slug: schoolSlug } });
    if (school) member = await db.member.update({ where: { id: member.id }, data: { schoolId: school.id } });
  }

  const updated = await db.member.update({
    where: { id: member.id },
    data: { accessStatus: "active", plan: plan ?? member.plan ?? "monthly" },
  });
  await emitEvent(member.id, "access_changed", { accessStatus: "active", plan: updated.plan, grantedBy: "admin" });

  return NextResponse.json({ ok: true, memberId: member.id, accessStatus: updated.accessStatus, schoolId: updated.schoolId });
}
