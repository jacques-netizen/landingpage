import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { config } from "../config";
import { addTags, createOpportunity, findOpenOpportunity, ghlEnabled, moveOpportunity, resolveStage, upsertContact } from "../ghl";
import type { JobOutcome } from "../jobs";
import { getLeadWithSession } from "../leads";
import { crmFields, crmTags } from "../leadview";

/** On a booking: opportunity to Sales (first stage by config), tag booked-via-guide. */
export async function runBookingCrm(leadId: string): Promise<JobOutcome> {
  if (!ghlEnabled()) return "skipped";
  const row = await getLeadWithSession(leadId);
  if (!row) throw new Error("lead not found");
  const { lead, session } = row;
  const c = config();
  const db = await getDb();
  const contactId =
    lead.ghlContactId ??
    (await upsertContact({ email: lead.email, firstName: lead.firstName, companyName: lead.company, fields: crmFields(lead, session.source), tags: crmTags(lead) }));
  const sales = await resolveStage(c.ghlPipelineSales, "sales_booked");
  const dm = await resolveStage(c.ghlPipelineDmSetting, "dm_setting_new");
  let oppId = lead.ghlOpportunityId;
  if (!oppId) oppId = (await findOpenOpportunity(contactId, dm.pipelineId))?.id ?? (await findOpenOpportunity(contactId, sales.pipelineId))?.id ?? null;
  if (oppId) await moveOpportunity(oppId, sales.pipelineId, sales.stageId);
  else oppId = await createOpportunity({ contactId, name: `${lead.firstName}${lead.company ? ` (${lead.company})` : ""}, guide funnel`, pipelineId: sales.pipelineId, stageId: sales.stageId });
  await addTags(contactId, ["booked-via-guide"]);
  await db.update(schema.leads).set({ ghlContactId: contactId, ghlOpportunityId: oppId }).where(eq(schema.leads.id, lead.id));
  return "done";
}
