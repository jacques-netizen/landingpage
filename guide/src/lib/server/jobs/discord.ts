import "server-only";
import { ghlEnabled } from "../ghl";
import type { JobOutcome } from "../jobs";
import { alertFor, sendDiscord } from "../discord";
import { getLead, type LeadRow } from "../leads";

/** The CRM job runs at the same time; give it a moment so the alert has the contact link. */
async function withContact(leadId: string): Promise<LeadRow | null> {
  let lead = await getLead(leadId);
  for (let i = 0; i < 10 && lead && ghlEnabled() && !lead.ghlContactId; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    lead = await getLead(leadId);
  }
  return lead;
}

export async function runDiscordLead(leadId: string): Promise<JobOutcome> {
  const first = await getLead(leadId);
  if (!first) throw new Error("lead not found");
  const kind = alertFor(first);
  if (!kind) return "skipped";
  const lead = (await withContact(leadId))!;
  return sendDiscord(kind, lead);
}

export async function runDiscordBooking(leadId: string): Promise<JobOutcome> {
  const lead = await withContact(leadId);
  if (!lead) throw new Error("lead not found");
  return sendDiscord("booking", lead);
}
