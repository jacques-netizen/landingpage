import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { pathOf, qualify, type Answers } from "@/lib/flow";
import { config } from "./config";

export type LeadRow = typeof schema.leads.$inferSelect;

export async function getLead(id: string): Promise<LeadRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
  return row ?? null;
}

export async function getLeadWithSession(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ lead: schema.leads, session: schema.sessions })
    .from(schema.leads)
    .innerJoin(schema.sessions, eq(schema.sessions.id, schema.leads.sessionId))
    .where(eq(schema.leads.id, id))
    .limit(1);
  return row ?? null;
}

export function scoreLead(answers: Answers) {
  const c = config();
  return { path: pathOf(answers) ?? "creator", ...qualify(answers, { qualifyMin: c.qualifyMin, priorityMin: c.priorityMin }) };
}

export const newMetaEventId = () => crypto.randomUUID();
