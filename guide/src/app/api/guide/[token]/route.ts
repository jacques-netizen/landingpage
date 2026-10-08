// GET /api/guide/[token]: the signed guide link. Builds the PDF if it is not
// there yet, then redirects to a short lived storage URL (or streams it
// when stored locally).
import { track } from "@/lib/server/track";
import { json } from "@/lib/server/http";
import { ensureGuidePdf, pdfFilename } from "@/lib/server/guide";
import { getLead } from "@/lib/server/leads";
import { readLocal, signedUrl } from "@/lib/server/storage";
import { verifyToken } from "@/lib/server/tokens";

export const maxDuration = 60;

export async function GET(req: Request, ctx: RouteContext<"/api/guide/[token]">) {
  const { token } = await ctx.params;
  const leadId = verifyToken(token, "guide");
  const lead = leadId ? await getLead(leadId) : null;
  if (!lead) return json({ error: "not_found" }, 404);
  const key = await ensureGuidePdf(lead);
  await track(lead.sessionId, "guide_download", { from: new URL(req.url).searchParams.get("from") || "link" });
  const url = await signedUrl(key, pdfFilename(lead));
  if (url) return Response.redirect(url, 302);
  const body = readLocal(key);
  if (!body) return json({ error: "not_found" }, 404);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${pdfFilename(lead)}"`,
      "cache-control": "private, no-store",
    },
  });
}
