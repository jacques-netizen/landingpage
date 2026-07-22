/**
 * Access control reads from the DB, never from Stripe at request time (Rule 1).
 *
 * Every campus is open to every active member regardless of order or what
 * else they've completed (product decision: no sequential gating). The
 * CampusOnSchool.order/gating columns still exist for display ordering, but
 * nothing here enforces them as a lock.
 */
import { db } from "./db";

export async function getMemberByClerkId(clerkUserId: string) {
  return db.member.findUnique({ where: { clerkUserId }, include: { school: true } });
}

export function hasActiveAccess(member: { accessStatus: string } | null): boolean {
  // past_due keeps access briefly — Stripe dunning handles recovery; hard cutoff on cancel.
  return !!member && (member.accessStatus === "active" || member.accessStatus === "past_due");
}

/** Lens filter: lens=null shows to everyone; lens-tagged content only to the matching school link. */
export function lensMatches(contentLens: string | null | undefined, schoolLens: string | null | undefined): boolean {
  return !contentLens || contentLens === schoolLens;
}
