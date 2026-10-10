import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { GuideDoc } from "@/lib/guide/doc";
import { config } from "../config";
import type { LeadRow } from "../leads";
import { objectExists, putObject } from "../storage";
import { briefFor } from "./brief";
import { composeDoc } from "./compose";
import { htmlToPdf } from "./pdf";
import { renderGuideHtml } from "./render";
import { rulesGuide } from "./rules";
import { writeWithAi } from "./writer";

export { guideInput } from "./input";

async function storedGuide(leadId: string): Promise<GuideDoc | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.guides).where(eq(schema.guides.leadId, leadId)).limit(1);
  const doc = row?.guideJson as GuideDoc | undefined;
  return doc && doc.version === 2 ? doc : null;
}

async function storeGuide(lead: LeadRow, doc: GuideDoc, error: string | null) {
  const db = await getDb();
  const set = { guideJson: doc, writerModel: doc.model, error };
  await db
    .insert(schema.guides)
    .values({ leadId: lead.id, status: "pending", ...set })
    .onConflictDoUpdate({ target: schema.guides.leadId, set });
}

/**
 * Writes the guide once and returns it. AI when configured, the rules writer
 * when not or when the AI call fails (the email still goes out). Safe to call
 * from several jobs: the first call stores it, later calls read it.
 */
export async function ensureGuide(lead: LeadRow, opts: { allowAi?: boolean } = {}): Promise<GuideDoc> {
  const stored = await storedGuide(lead.id);
  if (stored) return stored;
  const brief = briefFor(lead);
  const c = config();
  const allowAi = opts.allowAi ?? true;
  if (allowAi && c.guideWriter === "ai" && c.anthropicApiKey) {
    try {
      const started = Date.now();
      const r = await writeWithAi(brief);
      const doc = composeDoc(brief, r.written, { writer: "ai", model: r.model });
      await storeGuide(lead, doc, null);
      console.info(`guide written for lead ${lead.id} by ${r.model} in ${Date.now() - started}ms (${r.usage.input} in, ${r.usage.output} out)`);
      return doc;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`guide writer failed for lead ${lead.id}, using the rules writer:`, message);
      const doc = rulesGuide(lead, brief);
      await storeGuide(lead, doc, `writer: ${message}`.slice(0, 500));
      return doc;
    }
  }
  const doc = rulesGuide(lead, brief);
  await storeGuide(lead, doc, null);
  return doc;
}

/** The guide without writing one: null until the write job has run. */
export const guideIfReady = (leadId: string) => storedGuide(leadId);

const keyFor = (lead: LeadRow, doc: GuideDoc) => `guides/${lead.id}/${`${doc.contentVersion}-${doc.generatedAt}`.replace(/[^\w.+-]/g, "")}.pdf`;

export async function buildPdf(lead: LeadRow) {
  const doc = await ensureGuide(lead);
  const html = renderGuideHtml(doc, { asset: typeof lead.answers.asset === "string" ? lead.answers.asset : undefined, date: lead.createdAt });
  return { pdf: await htmlToPdf(html), doc };
}

/**
 * Makes sure the PDF for the stored guide exists and returns its storage
 * key. Safe to call many times: it builds only when missing.
 */
export async function ensureGuidePdf(lead: LeadRow): Promise<string> {
  const db = await getDb();
  const doc = await ensureGuide(lead);
  const key = keyFor(lead, doc);
  const [row] = await db.select().from(schema.guides).where(eq(schema.guides.leadId, lead.id)).limit(1);
  if (row?.storageKey === key && row.status === "ready" && (await objectExists(key))) return key;
  const html = renderGuideHtml(doc, { asset: typeof lead.answers.asset === "string" ? lead.answers.asset : undefined, date: lead.createdAt });
  const pdf = await htmlToPdf(html);
  await putObject(key, pdf, "application/pdf");
  await db
    .update(schema.guides)
    .set({ status: "ready", storageKey: key, generatedAt: new Date(), contentManifestVersion: doc.contentVersion, error: row?.error ?? null })
    .where(eq(schema.guides.leadId, lead.id));
  if (!row?.generatedAt) {
    await db.insert(schema.events).values({ sessionId: lead.sessionId, name: "build_complete", props: { path: lead.path, writer: doc.writer } });
  }
  return key;
}

export const pdfFilename = (lead: LeadRow) => `maison-delites-guide-${lead.path}.pdf`;
