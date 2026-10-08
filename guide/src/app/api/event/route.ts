// POST /api/event: first party analytics. No personal data is accepted.
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { cleanProps, EVENT_NAMES, type EventName } from "@/lib/events";
import { bad, json, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { findSession } from "@/lib/server/sessions";

const SERVER_ONLY: EventName[] = ["booking_created", "gate_submit", "build_complete"];

export async function POST(req: Request) {
  if (!(await rateLimit(req, "event", 400))) return tooMany();
  const body = await readJson<{ token?: string; name?: string; props?: unknown }>(req);
  const name = body?.name as EventName | undefined;
  if (!body || !name || !EVENT_NAMES.includes(name) || SERVER_ONLY.includes(name)) return bad();
  const session = await findSession(body.token);
  if (!session) return json({ error: "no_session" }, 404);
  const props = cleanProps(body.props);
  const db = await getDb();
  await db.insert(schema.events).values({ sessionId: session.id, name, props });
  if (name === "scene_view" && typeof props.scene === "string") {
    await db.update(schema.sessions).set({ lastScene: props.scene, updatedAt: new Date() }).where(eq(schema.sessions.id, session.id));
  }
  return json({ ok: true });
}
