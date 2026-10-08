import "server-only";
// Meta Conversions API. Lead on gate submit, Schedule on booking. Each event
// shares its event_id with the browser pixel so Meta deduplicates them.
import crypto from "node:crypto";
import { config } from "./config";
import type { LeadRow } from "./leads";

const GRAPH = "https://graph.facebook.com/v21.0";
const sha = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export const scheduleEventId = (leadId: string) => `schedule-${leadId}`;

/** fbc from the stored cookie, or built from the fbclid the visit arrived with. */
export function fbcFor(lead: LeadRow, source: Record<string, string>): string | undefined {
  if (lead.fbc) return lead.fbc;
  return source.fbclid ? `fb.1.${lead.createdAt.getTime()}.${source.fbclid}` : undefined;
}

export async function sendCapiEvent(lead: LeadRow, source: Record<string, string>, event: { name: "Lead" | "Schedule"; id: string; at: Date }) {
  const c = config();
  if (!c.metaPixelId || !c.metaCapiToken) return "skipped" as const;
  const user_data: Record<string, unknown> = {
    em: [sha(lead.email)],
    fn: [sha(lead.firstName)],
    external_id: [sha(lead.id)],
  };
  if (lead.clientIp) user_data.client_ip_address = lead.clientIp;
  if (lead.userAgent) user_data.client_user_agent = lead.userAgent;
  if (lead.fbp) user_data.fbp = lead.fbp;
  const fbc = fbcFor(lead, source);
  if (fbc) user_data.fbc = fbc;
  const body = {
    data: [
      {
        event_name: event.name,
        event_time: Math.floor(event.at.getTime() / 1000),
        event_id: event.id,
        action_source: "website",
        event_source_url: `${c.siteUrl}/`,
        user_data,
        custom_data: { content_category: lead.path, qualified: lead.qualified },
      },
    ],
    ...(c.metaTestEventCode ? { test_event_code: c.metaTestEventCode } : {}),
  };
  const res = await fetch(`${GRAPH}/${c.metaPixelId}/events?access_token=${encodeURIComponent(c.metaCapiToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Meta CAPI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "done" as const;
}
