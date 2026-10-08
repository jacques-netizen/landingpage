// GET /api/cron/jobs: retries failed or cut off background jobs. Vercel Cron
// calls it with the CRON_SECRET as a bearer token.
import { config } from "@/lib/server/config";
import { json } from "@/lib/server/http";
import { sweepJobs } from "@/lib/server/jobs";

export const maxDuration = 300;

export async function GET(req: Request) {
  const { cronSecret } = config();
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) return json({ error: "unauthorized" }, 401);
  const ran = await sweepJobs();
  return json({ ok: true, ran });
}
