import "server-only";
import type { JobOutcome } from "../jobs";

// Wired in a later phase.
export async function runPdf(_leadId: string): Promise<JobOutcome> {
  return "skipped";
}
