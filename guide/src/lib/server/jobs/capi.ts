import "server-only";
import type { JobOutcome } from "../jobs";
import { getLeadWithSession } from "../leads";
import { scheduleEventId, sendCapiEvent } from "../meta";

export async function runCapiLead(leadId: string): Promise<JobOutcome> {
  const row = await getLeadWithSession(leadId);
  if (!row) throw new Error("lead not found");
  return sendCapiEvent(row.lead, row.session.source, { name: "Lead", id: row.lead.metaEventId, at: row.lead.createdAt });
}

export async function runCapiSchedule(leadId: string): Promise<JobOutcome> {
  const row = await getLeadWithSession(leadId);
  if (!row) throw new Error("lead not found");
  return sendCapiEvent(row.lead, row.session.source, { name: "Schedule", id: scheduleEventId(row.lead.id), at: row.lead.bookedAt ?? new Date() });
}
