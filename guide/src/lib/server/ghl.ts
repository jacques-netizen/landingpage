import "server-only";
// GoHighLevel (LeadConnector API v2) with a private integration token scoped
// to the one sub-account. Pipelines and stages are looked up by name from
// config, never hard-coded ids. Custom fields are created when missing.
import { config } from "./config";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export const GHL_FIELDS = [
  "funnel_path",
  "asset",
  "platforms",
  "goal",
  "timing",
  "budget_band",
  "qualified",
  "human_priority",
  "guide_url",
  "source",
] as const;
export type GhlField = (typeof GHL_FIELDS)[number];

export const ghlEnabled = () => {
  const c = config();
  return Boolean(c.ghlToken && c.ghlLocationId);
};

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const c = config();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${c.ghlToken}`,
      Version: VERSION,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GHL ${method} ${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

type Stage = { id: string; name: string; position?: number };
type Pipeline = { id: string; name: string; stages: Stage[] };

let pipelineCache: { at: number; list: Pipeline[] } | null = null;
async function pipelines(): Promise<Pipeline[]> {
  if (pipelineCache && Date.now() - pipelineCache.at < 10 * 60_000) return pipelineCache.list;
  const data = await call<{ pipelines: Pipeline[] }>("GET", `/opportunities/pipelines?locationId=${config().ghlLocationId}`);
  pipelineCache = { at: Date.now(), list: data.pipelines ?? [] };
  return pipelineCache.list;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Resolves a pipeline name and a stage key from GHL_STAGE_MAP to ids. */
export async function resolveStage(pipelineName: string, stageKey: string): Promise<{ pipelineId: string; stageId: string }> {
  const p = (await pipelines()).find((x) => norm(x.name) === norm(pipelineName));
  if (!p) throw new Error(`GHL pipeline "${pipelineName}" not found`);
  const wanted = config().ghlStageMap[stageKey] ?? "first";
  const ordered = [...p.stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const stage = wanted === "first" ? ordered[0] : ordered.find((s) => norm(s.name) === norm(wanted));
  if (!stage) throw new Error(`GHL stage "${wanted}" not found in "${pipelineName}"`);
  return { pipelineId: p.id, stageId: stage.id };
}

type Field = { id: string; name: string; fieldKey: string };
let fieldCache: Map<string, string> | null = null;

/** Map of our field name to the GHL custom field id, creating missing ones. */
export async function ensureFields(): Promise<Map<string, string>> {
  if (fieldCache && GHL_FIELDS.every((f) => fieldCache!.has(f))) return fieldCache;
  const loc = config().ghlLocationId;
  const data = await call<{ customFields: Field[] }>("GET", `/locations/${loc}/customFields?model=contact`);
  const map = new Map<string, string>();
  for (const f of data.customFields ?? []) {
    const key = f.fieldKey?.replace(/^contact\./, "");
    if (key) map.set(key, f.id);
  }
  for (const name of GHL_FIELDS) {
    if (map.has(name)) continue;
    const created = await call<{ customField: Field }>("POST", `/locations/${loc}/customFields`, {
      name,
      dataType: "TEXT",
      model: "contact",
    });
    map.set(name, created.customField.id);
  }
  fieldCache = map;
  return map;
}

export async function upsertContact(input: {
  email: string;
  firstName: string;
  companyName?: string | null;
  igHandle?: string | null;
  fields: Partial<Record<GhlField, string>>;
  tags: string[];
}): Promise<string> {
  const ids = await ensureFields();
  const customFields = Object.entries(input.fields)
    .filter(([k, v]) => v !== undefined && ids.has(k))
    .map(([k, v]) => ({ id: ids.get(k)!, field_value: v }));
  const res = await call<{ contact: { id: string } }>("POST", "/contacts/upsert", {
    locationId: config().ghlLocationId,
    email: input.email,
    firstName: input.firstName,
    ...(input.companyName ? { companyName: input.companyName } : {}),
    source: "guide funnel",
    customFields,
  });
  const id = res.contact.id;
  // Tags go through the add endpoint so existing tags on the contact are kept.
  if (input.tags.length) await addTags(id, input.tags);
  return id;
}

export async function addTags(contactId: string, tags: string[]) {
  await call("POST", `/contacts/${contactId}/tags`, { tags });
}

type Opp = { id: string; pipelineId: string; pipelineStageId: string; status: string };

export async function findOpenOpportunity(contactId: string, pipelineId?: string): Promise<Opp | null> {
  const q = new URLSearchParams({ location_id: config().ghlLocationId, contact_id: contactId, status: "open", limit: "20" });
  if (pipelineId) q.set("pipeline_id", pipelineId);
  const data = await call<{ opportunities: Opp[] }>("GET", `/opportunities/search?${q}`);
  return data.opportunities?.[0] ?? null;
}

export async function createOpportunity(input: { contactId: string; name: string; pipelineId: string; stageId: string }): Promise<string> {
  const res = await call<{ opportunity: { id: string } }>("POST", "/opportunities/", {
    locationId: config().ghlLocationId,
    contactId: input.contactId,
    name: input.name,
    pipelineId: input.pipelineId,
    pipelineStageId: input.stageId,
    status: "open",
    source: "guide funnel",
  });
  return res.opportunity.id;
}

export async function moveOpportunity(id: string, pipelineId: string, stageId: string) {
  await call("PUT", `/opportunities/${id}`, { pipelineId, pipelineStageId: stageId });
}

export async function findContactByEmail(email: string): Promise<string | null> {
  const q = new URLSearchParams({ locationId: config().ghlLocationId, email });
  const data = await call<{ contact?: { id: string } | null }>("GET", `/contacts/search/duplicate?${q}`);
  return data.contact?.id ?? null;
}

/** Honors an unsubscribe: email do-not-disturb on, plus a tag for workflows. */
export async function markUnsubscribed(contactId: string) {
  await call("PUT", `/contacts/${contactId}`, { dndSettings: { Email: { status: "active", message: "Unsubscribed from guide emails" } } });
  await addTags(contactId, ["guide-unsubscribed"]);
}

export const contactUrl = (contactId: string) => `${config().ghlAppUrl}/v2/location/${config().ghlLocationId}/contacts/detail/${contactId}`;
