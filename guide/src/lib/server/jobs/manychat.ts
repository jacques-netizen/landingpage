import "server-only";
import type { JobOutcome } from "../jobs";

// Wired in a later phase.
export async function runManychat(_leadId: string): Promise<JobOutcome> {
  return "skipped";
}
