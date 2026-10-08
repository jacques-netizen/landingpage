import "server-only";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Answers } from "@/lib/flow";
import type { ProgressMode, Variant } from "@/lib/content";
import { config } from "./config";
import { maskEmail, randomToken, signToken } from "./tokens";
import { guideFor } from "./guide";

export type SessionRow = typeof schema.sessions.$inferSelect;

export async function findSession(token: unknown): Promise<SessionRow | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
  const db = await getDb();
  const [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, token)).limit(1);
  return row ?? null;
}

/** Random split from config. QA can force an arm with ?_v= and ?_p= on a new session. */
function assign(force: { variant?: unknown; progress?: unknown }): { variant: Variant; progressMode: ProgressMode } {
  const c = config();
  const variant: Variant =
    force.variant === "full" || force.variant === "plain" ? force.variant : crypto.randomInt(1_000_000) / 1_000_000 < c.variantSplit ? "full" : "plain";
  const progressMode: ProgressMode =
    force.progress === "front_loaded" || force.progress === "none"
      ? force.progress
      : crypto.randomInt(1_000_000) / 1_000_000 < c.progressSplit ? "front_loaded" : "none";
  return { variant, progressMode };
}

export async function createSession(input: {
  source: Record<string, string>;
  deviceClass: string;
  force: { variant?: unknown; progress?: unknown };
}): Promise<SessionRow> {
  const db = await getDb();
  const { variant, progressMode } = assign(input.force);
  const [row] = await db
    .insert(schema.sessions)
    .values({ token: randomToken(), source: input.source, variant, progressMode, deviceClass: input.deviceClass })
    .returning();
  return row;
}

export async function loadAnswers(sessionId: string): Promise<Answers> {
  const db = await getDb();
  const rows = await db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId));
  return Object.fromEntries(rows.map((r) => [r.questionId, r.value]));
}

export async function saveAnswer(sessionId: string, questionId: string, value: unknown) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (questionId === "role") {
      // A new path makes every later answer meaningless, so start them fresh.
      const [prev] = await tx
        .select()
        .from(schema.answers)
        .where(and(eq(schema.answers.sessionId, sessionId), eq(schema.answers.questionId, "role")));
      if (prev && prev.value !== value) await tx.delete(schema.answers).where(eq(schema.answers.sessionId, sessionId));
    }
    await tx
      .insert(schema.answers)
      .values({ sessionId, questionId, value })
      .onConflictDoUpdate({
        target: [schema.answers.sessionId, schema.answers.questionId],
        set: { value, answeredAt: new Date() },
      });
    await tx.update(schema.sessions).set({ updatedAt: new Date() }).where(eq(schema.sessions.id, sessionId));
  });
}

export async function leadForSession(sessionId: string) {
  const db = await getDb();
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.sessionId, sessionId)).limit(1);
  return lead ?? null;
}

export const guideToken = (leadId: string) => signToken(leadId, "guide");

/** What the browser gets back for a session. No raw personal data. */
export async function sessionState(s: SessionRow) {
  const [answers, lead] = await Promise.all([loadAnswers(s.id), leadForSession(s.id)]);
  return {
    token: s.token,
    variant: s.variant as Variant,
    progressMode: s.progressMode as ProgressMode,
    answers,
    lastScene: s.lastScene,
    lead: lead
      ? {
          guideToken: guideToken(lead.id),
          ref: lead.id,
          // Returned only to the browser holding this session's token, for the calendar prefill.
          email: lead.email,
          emailMasked: maskEmail(lead.email),
          company: lead.company,
          metaEventId: lead.metaEventId,
          firstName: lead.firstName,
          path: lead.path,
          qualified: lead.qualified,
          humanPriority: lead.humanPriority,
          answers: lead.answers,
          guideSections: guideFor(lead).sections.map((x) => x.title),
        }
      : null,
  };
}

export type SessionState = Awaited<ReturnType<typeof sessionState>>;
