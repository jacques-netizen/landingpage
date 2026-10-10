// POST /api/lead: the gate. Validates, checks the bot token, stores the lead
// once per session, queues the background jobs and returns the guide token.
import { after } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { copy } from "@/lib/content";
import { cleanAnswer, isAnswered, pathOf, type Answers } from "@/lib/flow";
import { bad, clientIp, json, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { enqueue, JOB_KINDS, runJobsForLead } from "@/lib/server/jobs";
import { newMetaEventId, scoreLead } from "@/lib/server/leads";
import { findSession, leadForSession, loadAnswers, saveAnswer, sessionState } from "@/lib/server/sessions";
import { verifyTurnstile } from "@/lib/server/turnstile";

export const maxDuration = 120;

const Body = z.object({
  token: z.string().min(16).max(64),
  firstName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().max(200).email(),
  igHandle: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(120).optional().default(""),
  role: z.string().max(20).optional(),
  consent: z.literal(true),
  turnstileToken: z.string().max(4096).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(400).optional(),
});

const fieldFor: Record<string, string> = { firstName: "firstName", email: "email", consent: "consent", company: "company", role: "role" };

const cleanHandle = (h: string) => h.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30) || null;
const cleanText = (s: string) => s.normalize("NFKC").replace(/[\u0000-\u001f<>]/g, "").trim();

export async function POST(req: Request) {
  if (!(await rateLimit(req, "lead", 8))) return tooMany();
  const raw = await readJson(req);
  if (!raw) return bad();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return json({ error: fieldFor[field] ?? "network", field: fieldFor[field] }, 400);
  }
  const b = parsed.data;

  const session = await findSession(b.token);
  if (!session) return json({ error: "network" }, 404);

  // Double submit or a refresh after success: hand back the same lead.
  if (await leadForSession(session.id)) return json(await sessionState(session));

  if (!(await verifyTurnstile(b.turnstileToken, clientIp(req)))) return json({ error: "bot" }, 400);

  // Server answers win. Answers the server missed (offline earlier) are taken
  // from the browser, but only after the same validation as /api/answer.
  let answers: Answers = await loadAnswers(session.id);
  if (b.role && session.variant === "plain") {
    const role = cleanAnswer("role", undefined, b.role);
    if (!role) return json({ error: "role", field: "role" }, 400);
    if (answers.role !== role) {
      await saveAnswer(session.id, "role", role);
      answers = { role };
    }
  }
  if (!pathOf(answers) && b.answers) {
    const role = cleanAnswer("role", undefined, b.answers.role);
    if (role) answers = { role };
  }
  const path = pathOf(answers);
  if (!path) return json({ error: "role", field: "role" }, 400);
  for (const [k, v] of Object.entries(b.answers ?? {})) {
    if (k === "role" || isAnswered(k, answers)) continue;
    const clean = cleanAnswer(k, path, v);
    if (clean !== null) {
      answers[k] = clean;
      await saveAnswer(session.id, k, clean);
    }
  }

  const company = cleanText(b.company);
  if (answers.deciding === "yes" && !company) return json({ error: "company", field: "company" }, 400);

  const score = scoreLead(answers);
  const db = await getDb();
  const inserted = await db
    .insert(schema.leads)
    .values({
      sessionId: session.id,
      firstName: cleanText(b.firstName).slice(0, 60),
      email: b.email,
      igHandle: cleanHandle(b.igHandle),
      company: answers.deciding === "yes" ? company.slice(0, 120) : null,
      consentTextVersion: copy.gate.consent.version,
      consentAt: new Date(),
      qualified: score.qualified,
      humanPriority: score.humanPriority,
      path: score.path,
      variant: session.variant,
      answers,
      metaEventId: newMetaEventId(),
      fbp: b.fbp || null,
      fbc: b.fbc || null,
      clientIp: clientIp(req),
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    })
    .onConflictDoNothing({ target: schema.leads.sessionId })
    .returning();

  const lead = inserted[0] ?? (await leadForSession(session.id));
  if (!lead) return json({ error: "network" }, 500);

  if (inserted[0]) {
    await db.insert(schema.guides).values({ leadId: lead.id }).onConflictDoNothing();
    await db.insert(schema.events).values({ sessionId: session.id, name: "gate_submit", props: { path: score.path, qualified: score.qualified, variant: session.variant } });
    await enqueue(lead.id, JOB_KINDS);
    after(() => runJobsForLead(lead.id));
  }

  return json(await sessionState(session));
}
