/**
 * Module progress + assignment shipments. Ranks are earned by SHIPPED
 * assignments, never watch time. Every transition emits an Event for the
 * setter queue (module_started, module_completed, campus_completed).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await db.member.findUnique({ where: { clerkUserId: userId } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const { action, moduleId, assignmentId, proofUrl, note } = await req.json();

  if (action === "start_module") {
    await db.moduleProgress.upsert({
      where: { memberId_moduleId: { memberId: member.id, moduleId } },
      update: {},
      create: { memberId: member.id, moduleId },
    });
    await emitEvent(member.id, "module_started", { moduleId });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_module") {
    await db.moduleProgress.upsert({
      where: { memberId_moduleId: { memberId: member.id, moduleId } },
      update: { completedAt: new Date() },
      create: { memberId: member.id, moduleId, completedAt: new Date() },
    });
    await emitEvent(member.id, "module_completed", { moduleId });

    // Campus completed? (all non-blocker, non-archived modules done)
    const mod = await db.module.findUnique({ where: { id: moduleId } });
    if (mod) {
      const siblings = await db.module.findMany({ where: { campusId: mod.campusId, archived: false, isBlocker: false } });
      const done = await db.moduleProgress.count({
        where: { memberId: member.id, moduleId: { in: siblings.map((m) => m.id) }, completedAt: { not: null } },
      });
      if (done === siblings.length) {
        await emitEvent(member.id, "campus_completed", { campusId: mod.campusId });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "ship_assignment") {
    await db.assignmentShipment.upsert({
      where: { memberId_assignmentId: { memberId: member.id, assignmentId } },
      update: { proofUrl: proofUrl ?? null, note: note ?? null },
      create: { memberId: member.id, assignmentId, proofUrl: proofUrl ?? null, note: note ?? null },
    });
    const shipped = await db.assignmentShipment.count({ where: { memberId: member.id } });
    await db.member.update({ where: { id: member.id }, data: { rank: shipped } });
    await emitEvent(member.id, "assignment_shipped", { assignmentId });
    return NextResponse.json({ ok: true, rank: shipped });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
