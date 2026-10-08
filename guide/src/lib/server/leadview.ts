import "server-only";
// Shared views of a lead for the CRM, email, alerts and the guide.
import type { Answers } from "@/lib/flow";
import { budgetOf } from "@/lib/flow";
import { config } from "./config";
import type { LeadRow } from "./leads";
import { guideToken } from "./sessions";

export const guideUrl = (leadId: string) => `${config().siteUrl}/g/${guideToken(leadId)}`;

export function budgetBand(answers: Answers): string {
  const b = budgetOf(answers);
  if (!b) return "";
  return b.band === "not_sure" && b.amount ? `not_sure:${b.amount}` : b.band;
}

export function crmFields(lead: LeadRow, source: Record<string, string>) {
  const a = lead.answers;
  return {
    funnel_path: lead.path,
    asset: typeof a.asset === "string" ? a.asset : "",
    platforms: Array.isArray(a.platforms) ? (a.platforms as string[]).join(",") : "",
    goal: typeof a.goal === "string" ? a.goal : "",
    timing: typeof a.timing === "string" ? a.timing : "",
    budget_band: budgetBand(a),
    qualified: lead.qualified ? "yes" : "no",
    human_priority: lead.humanPriority ? "yes" : "no",
    guide_url: guideUrl(lead.id),
    source: source.src || source.utm_source || "direct",
  };
}

export function crmTags(lead: LeadRow): string[] {
  return ["guide-lead", `path-${lead.path}`, lead.qualified ? "qualified" : "not-qualified", ...(lead.humanPriority ? ["human-priority"] : [])];
}
