import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ensureGuidePdf } from "../guide";
import type { JobOutcome } from "../jobs";
import { getLead } from "../leads";

export async function runPdf(leadId: string): Promise<JobOutcome> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("lead not found");
  try {
    await ensureGuidePdf(lead);
    return "done";
  } catch (e) {
    const db = await getDb();
    await db.update(schema.guides).set({ status: "failed", error: String(e).slice(0, 500) }).where(eq(schema.guides.leadId, leadId));
    throw e;
  }
}
