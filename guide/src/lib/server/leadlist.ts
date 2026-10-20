import "server-only";
// The submissions list for the owner: every lead, newest first, with the
// contact details. Only reached through the private link (see passwordOk).
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isOptin } from "@/lib/flow";

export type LeadListRow = {
  at: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  funnel: "opt-in" | "film";
  path: string;
  qualified: boolean;
  booked: boolean;
  source: string;
  campaign: string;
};

export async function leadList(limit = 1000): Promise<LeadListRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ lead: schema.leads, source: schema.sessions.source })
    .from(schema.leads)
    .innerJoin(schema.sessions, eq(schema.sessions.id, schema.leads.sessionId))
    .orderBy(desc(schema.leads.createdAt))
    .limit(limit);
  return rows.map(({ lead, source }) => ({
    at: lead.createdAt.toISOString(),
    firstName: lead.firstName,
    lastName: lead.lastName ?? "",
    email: lead.email,
    phone: lead.phone ?? "",
    funnel: isOptin(lead.answers) ? "opt-in" : "film",
    path: lead.path,
    qualified: lead.qualified,
    booked: Boolean(lead.bookedAt),
    source: source.src || source.utm_source || "direct",
    campaign: source.utm_campaign || "",
  }));
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // A leading = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function leadCsv(rows: LeadListRow[]): string {
  const head = ["date", "first_name", "last_name", "email", "phone", "funnel", "path", "qualified", "booked", "source", "campaign"];
  const lines = rows.map((r) => [r.at, r.firstName, r.lastName, r.email, r.phone, r.funnel, r.path, r.qualified ? "yes" : "no", r.booked ? "yes" : "no", r.source, r.campaign].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n");
}

/** Totals for the top of the submissions page. */
export function leadCounts(rows: LeadListRow[], now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  return {
    total: rows.length,
    today: rows.filter((r) => r.at.slice(0, 10) === today).length,
    week: rows.filter((r) => now - Date.parse(r.at) < 7 * 864e5).length,
    booked: rows.filter((r) => r.booked).length,
  };
}
