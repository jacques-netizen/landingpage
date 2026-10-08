// POST /api/unsubscribe?t=<token>: one click unsubscribe (RFC 8058) and the
// form on /u/[token]. GET never unsubscribes, so link scanners cannot.
import { json } from "@/lib/server/http";
import { verifyToken } from "@/lib/server/tokens";
import { unsubscribe } from "@/lib/server/unsubscribe";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = verifyToken(url.searchParams.get("t"), "unsub");
  if (!email) return json({ error: "invalid" }, 400);
  await unsubscribe(email);
  if (req.headers.get("accept")?.includes("text/html")) return Response.redirect(new URL(`/u/${url.searchParams.get("t")}?done=1`, req.url), 303);
  return json({ ok: true });
}
