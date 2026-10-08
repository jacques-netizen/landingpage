import "server-only";
// After the gate, tell the ManyChat DM thread that the guide was requested:
// a tag plus custom fields on the subscriber from the mc link param. Skips
// silently when there is no subscriber id or no token.
import { config } from "../config";
import type { JobOutcome } from "../jobs";
import { getLeadWithSession } from "../leads";
import { guideUrl } from "../leadview";

const API = "https://api.manychat.com/fb";

async function mc(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config().manychatToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  if (!res.ok || data.status !== "success") throw new Error(`ManyChat ${path} ${res.status}: ${data.message ?? ""}`);
}

export async function runManychat(leadId: string): Promise<JobOutcome> {
  const c = config();
  const row = await getLeadWithSession(leadId);
  if (!row) throw new Error("lead not found");
  const subscriberId = row.session.source.mc;
  if (!c.manychatToken || !subscriberId || !/^\d{1,30}$/.test(subscriberId)) return "skipped";
  await mc("/subscriber/addTagByName", { subscriber_id: subscriberId, tag_name: c.manychatTagName });
  // Fields are optional: they only land if the owner created them in ManyChat.
  const fields: Record<string, string> = {
    guide_path: row.lead.path,
    guide_qualified: row.lead.qualified ? "yes" : "no",
    guide_url: guideUrl(row.lead.id),
  };
  for (const [field_name, field_value] of Object.entries(fields)) {
    await mc("/subscriber/setCustomFieldByName", { subscriber_id: subscriberId, field_name, field_value }).catch((e) =>
      console.warn(`ManyChat field ${field_name} not set`, e instanceof Error ? e.message : e),
    );
  }
  return "done";
}
