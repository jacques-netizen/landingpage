// POST /api/session: resume a session by token, or create a new one.
import { bad, json, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { cleanSource, deviceClass } from "@/lib/server/source";
import { createSession, findSession, sessionState } from "@/lib/server/sessions";

export async function POST(req: Request) {
  if (!(await rateLimit(req, "session", 30))) return tooMany();
  const body = await readJson<{ token?: string; source?: unknown; force?: { variant?: unknown; progress?: unknown } }>(req);
  if (!body) return bad();
  const existing = await findSession(body.token);
  if (existing) return json(await sessionState(existing));
  const created = await createSession({
    source: cleanSource(body.source),
    deviceClass: deviceClass(req.headers.get("user-agent")),
    force: body.force ?? {},
  });
  return json(await sessionState(created), 201);
}
