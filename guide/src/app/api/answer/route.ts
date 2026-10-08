// POST /api/answer: saves one answer the moment it is given.
import { cleanAnswer, pathOf } from "@/lib/flow";
import { bad, json, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { findSession, leadForSession, loadAnswers, saveAnswer } from "@/lib/server/sessions";

export async function POST(req: Request) {
  if (!(await rateLimit(req, "answer", 120))) return tooMany();
  const body = await readJson<{ token?: string; questionId?: string; value?: unknown }>(req);
  if (!body || typeof body.questionId !== "string") return bad();
  const session = await findSession(body.token);
  if (!session) return json({ error: "no_session" }, 404);
  // Answers freeze once the gate is passed; the guide is built from them.
  if (await leadForSession(session.id)) return json({ error: "locked" }, 409);
  const current = await loadAnswers(session.id);
  const path = body.questionId === "role" ? undefined : pathOf(current);
  if (body.questionId !== "role" && !path) return bad("no_path");
  const value = cleanAnswer(body.questionId, path, body.value);
  if (value === null) return bad("invalid_answer");
  await saveAnswer(session.id, body.questionId, value);
  return json({ ok: true, value });
}
