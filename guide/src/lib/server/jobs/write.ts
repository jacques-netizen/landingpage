import "server-only";
import { ensureGuide } from "../guide";
import type { JobOutcome } from "../jobs";
import { getLead } from "../leads";

/** Writes the guide (AI or rules). Runs before the PDF and the email. */
export async function runWrite(leadId: string): Promise<JobOutcome> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("lead not found");
  await ensureGuide(lead);
  return "done";
}
