import "server-only";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] || req.headers.get("x-real-ip") || "0.0.0.0").trim();
}

/** Reads a JSON body, also when sent by sendBeacon as text/plain. */
export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 16_000): Promise<T | null> {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as T) : null;
  } catch {
    return null;
  }
}

/**
 * Fixed window rate limit stored in the database, so it holds across
 * serverless instances. Returns true when the request may go ahead.
 */
export async function rateLimit(req: Request, bucket: string, limit: number, windowSec = 60): Promise<boolean> {
  const key = `${bucket}:${clientIp(req)}`;
  try {
    const db = await getDb();
    const rows = await db.execute(sql`
      insert into ${schema.rateLimits} (key, window_start, count) values (${key}, now(), 1)
      on conflict (key) do update set
        count = case when ${schema.rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) then 1 else ${schema.rateLimits.count} + 1 end,
        window_start = case when ${schema.rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) then now() else ${schema.rateLimits.windowStart} end
      returning count`);
    const list = (Array.isArray(rows) ? rows : (rows as unknown as { rows: { count: number }[] }).rows) as { count: number }[];
    return Number(list[0]?.count ?? 0) <= limit;
  } catch (e) {
    console.error("rate limit check failed", e);
    return true;
  }
}

export const tooMany = () => json({ error: "rate_limited" }, 429);
export const bad = (error = "bad_request") => json({ error }, 400);
