import "server-only";
// Team alerts. Never includes an email address (section 8.6).
import { optionLabel, type Path } from "@/lib/content";
import { config } from "./config";
import { contactUrl } from "./ghl";
import type { LeadRow } from "./leads";
import { budgetBand } from "./leadview";

export type AlertKind = "qualified" | "priority" | "booking";

const COLORS: Record<AlertKind, number> = { qualified: 0xa8843a, priority: 0xc2412a, booking: 0x2f7d4f };
const TITLES: Record<AlertKind, string> = {
  qualified: "New qualified guide lead",
  priority: "HUMAN PRIORITY: guide lead needs a person now",
  booking: "Call booked from the guide",
};

export function alertFor(lead: LeadRow): AlertKind | null {
  if (lead.humanPriority) return "priority";
  if (lead.qualified) return "qualified";
  return null;
}

/** The Discord message body. Exported for tests: it must never carry an email. */
export function discordMessage(kind: AlertKind, lead: LeadRow) {
  const path = lead.path as Path;
  const asset = typeof lead.answers.asset === "string" ? lead.answers.asset : "";
  const fields = [
    { name: "Path", value: lead.path, inline: true },
    { name: "Asset", value: optionLabel("asset", path, asset) ?? (asset || "n/a"), inline: true },
    { name: "Budget band", value: budgetBand(lead.answers) || "n/a", inline: true },
    ...(lead.company ? [{ name: "Company", value: lead.company, inline: true }] : []),
    { name: "Instagram", value: lead.igHandle ? `@${lead.igHandle}` : "n/a", inline: true },
    { name: "First name", value: lead.firstName, inline: true },
    { name: "GHL contact", value: lead.ghlContactId ? contactUrl(lead.ghlContactId) : "not synced yet", inline: false },
  ];
  return {
    username: "Guide funnel",
    content: kind === "priority" ? "@here human priority lead" : undefined,
    allowed_mentions: { parse: kind === "priority" ? ["everyone"] : [] },
    embeds: [{ title: TITLES[kind], color: COLORS[kind], fields, timestamp: new Date().toISOString() }],
  };
}

export async function sendDiscord(kind: AlertKind, lead: LeadRow) {
  const url = config().discordWebhookUrl;
  if (!url) return "skipped" as const;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(discordMessage(kind, lead)),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return "done" as const;
}
