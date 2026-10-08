import "server-only";
import type { JobOutcome } from "../jobs";

// Wired in a later phase.
export async function runCapiLead(_leadId: string): Promise<JobOutcome> {
  return "skipped";
}

export async function runCapiSchedule(_leadId: string): Promise<JobOutcome> {
  return "skipped";
}
