import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Path } from "@/lib/content";
import { pathOf } from "@/lib/flow";
import { config } from "../config";
import { bookingUrl } from "../email";
import type { LeadRow } from "../leads";
import { offersCall } from "../leadview";
import { objectExists, putObject } from "../storage";
import { assembleGuide, manifestVersion, type GuideInput } from "./assemble";
import { htmlToPdf } from "./pdf";
import { renderGuideHtml } from "./render";

export function guideInput(lead: LeadRow): GuideInput {
  const c = config();
  const path = (pathOf(lead.answers) ?? lead.path) as Path;
  return {
    path,
    answers: lead.answers,
    // Picks the "book a call" next step in the guide, not the CRM flag.
    qualified: offersCall(lead),
    firstName: lead.firstName,
    bookingUrl: offersCall(lead) ? bookingUrl(lead) : "",
    joinUrl: path === "clipper" ? c.whopJoinUrl : "",
  };
}

export const guideFor = (lead: LeadRow) => assembleGuide(guideInput(lead));

const keyFor = (lead: LeadRow, version: string) => `guides/${lead.id}/${version.replace(/[^\w.+-]/g, "")}.pdf`;

export async function buildPdf(lead: LeadRow) {
  const guide = guideFor(lead);
  const html = renderGuideHtml(guide, { asset: typeof lead.answers.asset === "string" ? lead.answers.asset : undefined, date: lead.createdAt });
  return { pdf: await htmlToPdf(html), guide };
}

/**
 * Makes sure the PDF for the current content version exists and returns its
 * storage key. Safe to call many times: it builds only when missing.
 */
export async function ensureGuidePdf(lead: LeadRow): Promise<string> {
  const db = await getDb();
  const version = manifestVersion();
  const key = keyFor(lead, version);
  const [row] = await db.select().from(schema.guides).where(eq(schema.guides.leadId, lead.id)).limit(1);
  if (row?.storageKey === key && row.status === "ready" && (await objectExists(key))) return key;
  const { pdf } = await buildPdf(lead);
  await putObject(key, pdf, "application/pdf");
  await db
    .insert(schema.guides)
    .values({ leadId: lead.id, status: "ready", storageKey: key, generatedAt: new Date(), contentManifestVersion: version })
    .onConflictDoUpdate({
      target: schema.guides.leadId,
      set: { status: "ready", storageKey: key, generatedAt: new Date(), contentManifestVersion: version, error: null },
    });
  if (!row?.generatedAt) {
    await db.insert(schema.events).values({ sessionId: lead.sessionId, name: "build_complete", props: { path: lead.path } });
  }
  return key;
}

export const pdfFilename = (lead: LeadRow) => `maison-delites-guide-${lead.path}.pdf`;
