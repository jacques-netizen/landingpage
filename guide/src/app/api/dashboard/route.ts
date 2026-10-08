// POST /api/dashboard: password form for /dashboard. Sets a signed cookie.
import { cookies } from "next/headers";
import { rateLimit, tooMany } from "@/lib/server/http";
import { DASH_COOKIE, dashCookieValue, passwordOk } from "@/lib/server/dashauth";

export async function POST(req: Request) {
  if (!(await rateLimit(req, "dash", 10, 300))) return tooMany();
  const form = await req.formData();
  const ok = passwordOk(form.get("password"));
  if (ok) {
    (await cookies()).set(DASH_COOKIE, dashCookieValue(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/dashboard", maxAge: 60 * 60 * 24 * 14 });
  }
  return Response.redirect(new URL(ok ? "/dashboard" : "/dashboard?e=1", req.url), 303);
}
