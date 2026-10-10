import "server-only";
import type { Path } from "@/lib/content";
import { pathOf } from "@/lib/flow";
import { config } from "../config";
import { bookingUrl } from "../email";
import type { LeadRow } from "../leads";
import { offersCall } from "../leadview";
import type { GuideInput } from "./assemble";

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
