// POST /api/webhooks/cal: Cal.com booking events, signed with
// CAL_WEBHOOK_SECRET (x-cal-signature-256, HMAC SHA-256 of the raw body).
// BOOKING_CREATED: match the lead, record the booking, queue the CRM move,
// the Meta Schedule event and the Discord alert.
import { after } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { config } from "@/lib/server/config";
import { verifyCalSignature } from "@/lib/server/cal";
import { json } from "@/lib/server/http";
import { BOOKING_JOB_KINDS, enqueue, runJobsForLead } from "@/lib/server/jobs";
import { track } from "@/lib/server/track";

type CalPayload = {
  triggerEvent?: string;
  payload?: {
    uid?: string;
    attendees?: { email?: string; name?: string }[];
    responses?: { email?: { value?: string } | string };
    metadata?: Record<string, unknown>;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyCalSignature(raw, req.headers.get("x-cal-signature-256"), config().calWebhookSecret)) {
    return json({ error: "bad_signature" }, 401);
  }
  let body: CalPayload;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (body.triggerEvent !== "BOOKING_CREATED") return json({ ok: true, ignored: body.triggerEvent ?? null });

  const p = body.payload ?? {};
  const db = await getDb();
  const ref = typeof p.metadata?.lead === "string" && UUID.test(p.metadata.lead) ? p.metadata.lead : null;
  const responseEmail = typeof p.responses?.email === "string" ? p.responses.email : p.responses?.email?.value;
  const email = (p.attendees?.[0]?.email || responseEmail || "").trim().toLowerCase();

  let [lead] = ref ? await db.select().from(schema.leads).where(eq(schema.leads.id, ref)).limit(1) : [];
  if (!lead && email) {
    [lead] = await db.select().from(schema.leads).where(eq(schema.leads.email, email)).orderBy(desc(schema.leads.createdAt)).limit(1);
  }
  // A booking from someone who never went through the guide is not ours to handle.
  if (!lead) return json({ ok: true, matched: false });

  if (!lead.bookedAt) {
    await db.update(schema.leads).set({ bookedAt: new Date() }).where(eq(schema.leads.id, lead.id));
    await track(lead.sessionId, "booking_created", { path: lead.path, qualified: lead.qualified });
  }
  await enqueue(lead.id, BOOKING_JOB_KINDS);
  after(() => runJobsForLead(lead.id));
  return json({ ok: true, matched: true });
}
