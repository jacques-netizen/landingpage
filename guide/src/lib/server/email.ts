import "server-only";
// The single delivery email. Plain and short, HTML plus text. Copy lives in
// content/email.json; the signature and legal footer come from config.
import fs from "node:fs";
import path from "node:path";
import emailCopy from "../../../content/email.json";
import { fill, resultText, type Path } from "@/lib/content";
import { pathOf } from "@/lib/flow";
import { config } from "./config";
import type { LeadRow } from "./leads";
import { guideUrl } from "./leadview";
import { signToken } from "./tokens";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const unsubscribeUrl = (email: string) => `${config().siteUrl}/u/${signToken(email.toLowerCase(), "unsub")}`;

export function bookingUrl(lead: Pick<LeadRow, "firstName" | "email">) {
  const base = config().calBookingUrl;
  if (!base) return "";
  const u = new URL(base);
  u.searchParams.set("name", lead.firstName);
  u.searchParams.set("email", lead.email);
  return u.toString();
}

export function buildDeliveryEmail(lead: LeadRow) {
  const c = config();
  const e = emailCopy;
  const p = (pathOf(lead.answers) ?? lead.path) as Path;
  const asset = typeof lead.answers.asset === "string" ? lead.answers.asset : undefined;
  const headline = resultText(p, asset).headline;
  const guide = guideUrl(lead.id);
  const unsub = unsubscribeUrl(lead.email);

  type Next = { text: string; button?: string; href?: string };
  let next: Next;
  if (p === "clipper") next = { ...e.next.join, href: c.whopJoinUrl || undefined };
  else if (lead.qualified && c.calBookingUrl) next = { ...e.next.book, href: bookingUrl(lead) };
  else next = e.next.soft;

  const subject = fill(e.subject, { headline });
  const greeting = fill(e.greeting, { firstName: lead.firstName });

  const text = [
    greeting,
    "",
    e.intro,
    "",
    `${e.guideButton}: ${guide}`,
    "",
    next.text,
    ...(next.href && next.button ? [`${next.button}: ${next.href}`] : []),
    "",
    c.emailSignature,
    "",
    "--",
    e.unsubscribeNote,
    `${e.unsubscribe}: ${unsub}`,
    c.emailFooterLegal,
  ].join("\n");

  const button = (href: string, label: string) =>
    `<a href="${esc(href)}" style="display:inline-block;background:#1a1510;color:#ffffff;text-decoration:none;font:500 15px/1 Arial,Helvetica,sans-serif;padding:16px 26px;border-radius:999px">${esc(label)}</a>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2eee6">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(e.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee6"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="font:400 13px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.08em;color:#1a1510;padding-bottom:36px">MAISON D&#8217;&#201;LITES</td></tr>
<tr><td style="font:400 34px/1.1 Georgia,'Times New Roman',serif;color:#1a1510;padding-bottom:24px">${esc(headline)}</td></tr>
<tr><td style="font:400 16px/1.6 Arial,Helvetica,sans-serif;color:#4f493f;padding-bottom:12px">${esc(greeting)}</td></tr>
<tr><td style="font:400 16px/1.6 Arial,Helvetica,sans-serif;color:#4f493f;padding-bottom:28px">${esc(e.intro)}</td></tr>
<tr><td style="padding-bottom:36px">${button(guide, e.guideButton)}</td></tr>
<tr><td style="border-top:1px solid #d8cdb9;padding-top:28px;font:400 16px/1.6 Arial,Helvetica,sans-serif;color:#4f493f;padding-bottom:${next.href ? "20px" : "28px"}">${esc(next.text)}</td></tr>
${next.href && next.button ? `<tr><td style="padding-bottom:36px">${button(next.href, next.button)}</td></tr>` : ""}
<tr><td style="font:400 16px/1.6 Georgia,'Times New Roman',serif;color:#1a1510;padding-bottom:40px">${esc(c.emailSignature)}</td></tr>
<tr><td style="border-top:1px solid #d8cdb9;padding-top:20px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6e675c">${esc(e.unsubscribeNote)} <a href="${esc(unsub)}" style="color:#6e675c">${esc(e.unsubscribe)}</a><br>${esc(c.emailFooterLegal)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html, unsub };
}

/** Sends through Resend. Without a key, writes the email to .data/outbox for review. */
export async function sendEmail(to: string, msg: { subject: string; text: string; html: string; unsub: string }, idempotencyKey: string) {
  const c = config();
  if (!c.resendApiKey) {
    const dir = path.join(process.cwd(), ".data", "outbox");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${idempotencyKey}.html`), msg.html);
    fs.writeFileSync(path.join(dir, `${idempotencyKey}.txt`), `To: ${to}\nSubject: ${msg.subject}\n\n${msg.text}`);
    console.info(`[email] RESEND_API_KEY not set, wrote .data/outbox/${idempotencyKey}.html`);
    return "skipped" as const;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.resendApiKey}`,
      "Content-Type": "application/json",
      // Resend drops a repeat send with the same key, so a retried job never doubles up.
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: c.emailFrom,
      to: [to],
      ...(c.emailReplyTo ? { reply_to: c.emailReplyTo } : {}),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: {
        "List-Unsubscribe": `<${msg.unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "done" as const;
}
