/**
 * Access control reads from the DB, never from Stripe at request time (Rule 1).
 * Gating logic is driven by DATA (CampusOnSchool.gating + order, module order),
 * so restructuring the curriculum never requires code changes here.
 */
import { db } from "./db";

export async function getMemberByClerkId(clerkUserId: string) {
  return db.member.findUnique({ where: { clerkUserId }, include: { school: true } });
}

export function hasActiveAccess(member: { accessStatus: string } | null): boolean {
  // past_due keeps access briefly — Stripe dunning handles recovery; hard cutoff on cancel.
  return !!member && (member.accessStatus === "active" || member.accessStatus === "past_due");
}

/**
 * Sequential gating: a campus is unlocked when all lower-order campuses with
 * gating="sequential" in the member's school have their non-blocker modules
 * completed. Foundation gates everything simply because it's order 1 —
 * reorder in the JSON and the gating follows; no code change.
 */
export async function isCampusUnlocked(memberId: string, schoolId: string, campusId: string): Promise<boolean> {
  const links = await db.campusOnSchool.findMany({
    where: { schoolId },
    orderBy: { order: "asc" },
    include: { campus: { include: { modules: { where: { archived: false, isBlocker: false } } } } },
  });
  const target = links.find((l) => l.campusId === campusId);
  if (!target) return false;
  if (target.gating === "open") return true;

  const prerequisites = links.filter((l) => l.order < target.order && l.gating === "sequential");
  for (const prereq of prerequisites) {
    const moduleIds = prereq.campus.modules.map((m) => m.id);
    if (moduleIds.length === 0) continue;
    const completed = await db.moduleProgress.count({
      where: { memberId, moduleId: { in: moduleIds }, completedAt: { not: null } },
    });
    if (completed < moduleIds.length) return false;
  }
  return true;
}

/** Lens filter: lens=null shows to everyone; lens-tagged content only to the matching school link. */
export function lensMatches(contentLens: string | null | undefined, schoolLens: string | null | undefined): boolean {
  return !contentLens || contentLens === schoolLens;
}
