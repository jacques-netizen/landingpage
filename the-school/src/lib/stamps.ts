/**
 * The stamp is earned by SHIPPED work (design study §3 / CLAUDE.md Rule 1),
 * not by watch time. A module with an assignment only earns its stamp when
 * that assignment has been shipped; a module with no assignment earns it
 * when marked complete (there's nothing to ship).
 */
import { db } from "./db";

export async function getStampedModuleIds(memberId: string, moduleIds: string[]): Promise<Set<string>> {
  if (moduleIds.length === 0) return new Set();

  const modules = await db.module.findMany({
    where: { id: { in: moduleIds } },
    select: { id: true, assignment: { select: { id: true } } },
  });
  const withAssignment = modules.filter((m) => m.assignment);
  const withoutAssignment = modules.filter((m) => !m.assignment);

  const [shipments, progress] = await Promise.all([
    withAssignment.length > 0
      ? db.assignmentShipment.findMany({
          where: { memberId, assignmentId: { in: withAssignment.map((m) => m.assignment!.id) } },
          select: { assignmentId: true },
        })
      : Promise.resolve([]),
    withoutAssignment.length > 0
      ? db.moduleProgress.findMany({
          where: { memberId, moduleId: { in: withoutAssignment.map((m) => m.id) }, completedAt: { not: null } },
          select: { moduleId: true },
        })
      : Promise.resolve([]),
  ]);

  const shippedAssignmentIds = new Set(shipments.map((s) => s.assignmentId));
  const earned = withAssignment
    .filter((m) => shippedAssignmentIds.has(m.assignment!.id))
    .map((m) => m.id)
    .concat(progress.map((p) => p.moduleId));

  return new Set(earned);
}

export function tierName(totalEarned: number): string {
  if (totalEarned >= 41) return "Laureate";
  if (totalEarned >= 25) return "Fellow";
  if (totalEarned >= 10) return "Associate";
  return "Enrolled";
}
