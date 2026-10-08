import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { buildDeliveryEmail, sendEmail } from "../email";
import type { JobOutcome } from "../jobs";
import { getLead } from "../leads";

export async function runEmail(leadId: string): Promise<JobOutcome> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("lead not found");
  const db = await getDb();
  const [unsub] = await db.select().from(schema.unsubscribes).where(eq(schema.unsubscribes.email, lead.email)).limit(1);
  if (unsub) return "skipped";
  const outcome = await sendEmail(lead.email, buildDeliveryEmail(lead), `guide-${lead.id}`);
  if (outcome === "done") await db.update(schema.guides).set({ emailedAt: new Date() }).where(eq(schema.guides.leadId, lead.id));
  return outcome;
}
