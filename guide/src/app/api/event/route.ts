// POST /api/event: first party analytics. No personal data is accepted.
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { cleanProps, EVENT_NAMES, type EventName } from "@/lib/events";
import { bad, json, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { findSession } from "@/lib/server/sessions";
import { verifyToken } from "@/lib/server/tokens";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The session behind a signed lead link (?l= in the delivery email). */
async function sessionIdForLead(ref: unknown): Promise<string | null> {
  const id = typeof ref === "string" ? verifyToken(ref, "lead") : null;
  if (!id || !UUID.test(id)) return null;
  const db = await getDb();
  const [row] = await db.select({ sessionId: schema.leads.sessionId }).from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
  return row?.sessionId ?? null;
}

const SERVER_ONLY: EventName[] = ["booking_created", "gate_submit", "build_complete"];

export async function POST(req: Request) {
  if (!(await rateLimit(req, "event", 400))) return tooMany();
  const body = await readJson<{ token?: string; lead?: string; name?: string; props?: unknown }>(req);
  const name = body?.name as EventName | undefined;
  if (!body || !name || !EVENT_NAMES.includes(name) || SERVER_ONLY.includes(name)) return bad();
  const sessionId = (await findSession(body.token))?.id ?? (await sessionIdForLead(body.lead));
  if (!sessionId) return json({ error: "no_session" }, 404);
  const props = cleanProps(body.props);
  const db = await getDb();
  await db.insert(schema.events).values({ sessionId, name, props });
  if (name === "scene_view" && typeof props.scene === "string") {
    await db.update(schema.sessions).set({ lastScene: props.scene, updatedAt: new Date() }).where(eq(schema.sessions.id, sessionId));
  }
  return json({ ok: true });
}
