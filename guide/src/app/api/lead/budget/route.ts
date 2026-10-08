// POST /api/lead/budget: the optional number on the soft next step. A number
// at or above BUDGET_QUALIFY_MIN qualifies the lead, which opens the calendar
// and re-syncs the CRM (adding the DM Setting opportunity).
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { pathOf } from "@/lib/flow";
import { bad, json, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { rerun, runJobsForLead } from "@/lib/server/jobs";
import { scoreLead } from "@/lib/server/leads";
import { findSession, leadForSession, sessionState } from "@/lib/server/sessions";

export async function POST(req: Request) {
  if (!(await rateLimit(req, "budget", 10))) return tooMany();
  const body = await readJson<{ token?: string; amount?: unknown }>(req);
  const amount = typeof body?.amount === "number" && Number.isFinite(body.amount) ? Math.round(body.amount) : NaN;
  if (!body || !(amount > 0 && amount < 1e9)) return bad();
  const session = await findSession(body.token);
  const lead = session ? await leadForSession(session.id) : null;
  if (!session || !lead) return json({ error: "no_lead" }, 404);
  const path = pathOf(lead.answers);
  if (path !== "creator" && path !== "brand") return bad("not_buyer");
  if (lead.qualified) return json(await sessionState(session));

  const answers = { ...lead.answers, budget: { band: "not_sure", amount } };
  const score = scoreLead(answers);
  const db = await getDb();
  await db
    .update(schema.leads)
    .set({ answers, qualified: score.qualified, humanPriority: score.humanPriority })
    .where(eq(schema.leads.id, lead.id));
  await rerun(lead.id, score.qualified ? ["crm", "discord"] : ["crm"]);
  after(() => runJobsForLead(lead.id));
  return json(await sessionState(session));
}
