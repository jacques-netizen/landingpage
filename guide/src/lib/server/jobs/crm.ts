import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { config } from "../config";
import { createOpportunity, findOpenOpportunity, ghlEnabled, resolveStage, upsertContact } from "../ghl";
import type { JobOutcome } from "../jobs";
import { getLeadWithSession } from "../leads";
import { crmFields, crmTags } from "../leadview";

/** Contact for every lead; an opportunity in DM Setting for qualified leads. */
export async function runCrm(leadId: string): Promise<JobOutcome> {
  if (!ghlEnabled()) {
    console.info(`[crm] GHL not configured, skipped lead ${leadId}`);
    return "skipped";
  }
  const row = await getLeadWithSession(leadId);
  if (!row) throw new Error("lead not found");
  const { lead, session } = row;
  const db = await getDb();

  const contactId = await upsertContact({
    email: lead.email,
    firstName: lead.firstName,
    companyName: lead.company,
    igHandle: lead.igHandle,
    fields: crmFields(lead, session.source),
    tags: crmTags(lead),
  });
  if (lead.ghlContactId !== contactId) {
    await db.update(schema.leads).set({ ghlContactId: contactId }).where(eq(schema.leads.id, lead.id));
  }

  if (lead.qualified && !lead.ghlOpportunityId) {
    const c = config();
    const { pipelineId, stageId } = await resolveStage(c.ghlPipelineDmSetting, "dm_setting_new");
    // The same person may already have an open deal; reuse it rather than duplicate.
    const existing = await findOpenOpportunity(contactId, pipelineId);
    const oppId =
      existing?.id ??
      (await createOpportunity({ contactId, name: `${lead.firstName}${lead.company ? ` (${lead.company})` : ""}, guide funnel`, pipelineId, stageId }));
    await db.update(schema.leads).set({ ghlOpportunityId: oppId }).where(eq(schema.leads.id, lead.id));
  }
  return "done";
}
