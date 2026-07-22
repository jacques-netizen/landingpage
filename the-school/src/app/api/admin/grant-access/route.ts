/**
 * Manual access grant (comps, support unlocks, previewing without a real
 * checkout). Writes to the same Member.accessStatus field the Stripe
 * webhook writes to (Rule 1: access always reads from the DB), so the rest
 * of the spine — dashboard gating, Discord role sync — behaves identically
 * to a real paid member once this runs.
 *
 * Gated by ADMIN_SECRET (set in Vercel env, never in code) rather than
 * Clerk session, so it can be called directly (support tooling, scripts).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const { email, secret, plan } = (await req.json()) as { email: string; secret: string; plan?: string };

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await db.member.findUnique({ where: { email } });
  if (!member) return NextResponse.json({ error: "No member with that email — sign up first" }, { status: 404 });

  const updated = await db.member.update({
    where: { id: member.id },
    data: { accessStatus: "active", plan: plan ?? member.plan ?? "monthly" },
  });
  await emitEvent(member.id, "access_changed", { accessStatus: "active", plan: updated.plan, grantedBy: "admin" });

  return NextResponse.json({ ok: true, memberId: member.id, accessStatus: updated.accessStatus });
}
