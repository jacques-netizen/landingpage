import "server-only";
// Background work after the gate. Each job is one row per lead and kind, run
// at most once to completion, retried with backoff on failure. Jobs start
// right after the response (next/server after) and a cron route sweeps up
// anything that failed or was cut off.
import { and, eq, inArray, lte, or, isNull, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const JOB_KINDS = ["pdf", "crm", "email", "capi", "discord", "manychat"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export type JobOutcome = "done" | "skipped";
export type JobHandler = (leadId: string) => Promise<JobOutcome>;

const MAX_ATTEMPTS = 6;
const backoffSec = (attempt: number) => Math.min(3600, 30 * 2 ** attempt);

const handlers: Partial<Record<JobKind, () => Promise<JobHandler>>> = {
  pdf: async () => (await import("./jobs/pdf")).runPdf,
  crm: async () => (await import("./jobs/crm")).runCrm,
  email: async () => (await import("./jobs/email")).runEmail,
  capi: async () => (await import("./jobs/capi")).runCapiLead,
  discord: async () => (await import("./jobs/discord")).runDiscordLead,
  manychat: async () => (await import("./jobs/manychat")).runManychat,
};

export async function enqueue(leadId: string, kinds: readonly JobKind[]) {
  const db = await getDb();
  await db
    .insert(schema.jobs)
    .values(kinds.map((kind) => ({ leadId, kind })))
    .onConflictDoNothing();
}

/** Claims one job row so two runners never work the same job. */
async function claim(id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(schema.jobs)
    .set({ status: "running", lockedUntil: sql`now() + interval '3 minutes'`, attempts: sql`${schema.jobs.attempts} + 1` })
    .where(
      and(
        eq(schema.jobs.id, id),
        inArray(schema.jobs.status, ["pending", "failed", "running"]),
        or(isNull(schema.jobs.lockedUntil), lt(schema.jobs.lockedUntil, sql`now()`)),
      ),
    )
    .returning({ id: schema.jobs.id });
  return rows.length === 1;
}

async function runOne(job: typeof schema.jobs.$inferSelect) {
  const db = await getDb();
  if (!(await claim(job.id))) return;
  const load = handlers[job.kind as JobKind];
  try {
    if (!load) throw new Error(`no handler for ${job.kind}`);
    const outcome = await (await load())(job.leadId);
    await db.update(schema.jobs).set({ status: outcome, doneAt: new Date(), lockedUntil: null, lastError: null }).where(eq(schema.jobs.id, job.id));
  } catch (e) {
    const attempts = job.attempts + 1;
    const message = e instanceof Error ? e.message : String(e);
    console.error(`job ${job.kind} for lead ${job.leadId} failed (attempt ${attempts})`, message);
    await db
      .update(schema.jobs)
      .set({
        status: attempts >= MAX_ATTEMPTS ? "dead" : "failed",
        lastError: message.slice(0, 1000),
        lockedUntil: null,
        runAfter: sql`now() + make_interval(secs => ${backoffSec(attempts)})`,
      })
      .where(eq(schema.jobs.id, job.id));
  }
}

/** Runs every due job for one lead. Jobs run side by side; each is independent. */
export async function runJobsForLead(leadId: string) {
  const db = await getDb();
  const due = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.leadId, leadId), inArray(schema.jobs.status, ["pending", "failed"]), lte(schema.jobs.runAfter, sql`now()`)));
  await Promise.all(due.map(runOne));
}

/** Cron sweep: due jobs across all leads, plus runs that were cut off. */
export async function sweepJobs(limit = 25) {
  const db = await getDb();
  const due = await db
    .select()
    .from(schema.jobs)
    .where(
      or(
        and(inArray(schema.jobs.status, ["pending", "failed"]), lte(schema.jobs.runAfter, sql`now()`)),
        and(eq(schema.jobs.status, "running"), lt(schema.jobs.lockedUntil, sql`now()`)),
      ),
    )
    .limit(limit);
  await Promise.all(due.map(runOne));
  return due.length;
}
