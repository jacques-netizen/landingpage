import 'server-only'
import { brand, env } from '@mde/config'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type Email = { to: string; subject: string; text: string; html: string }

// Without EMAIL_API_KEY, development writes emails to this file instead of sending them, and so
// does a production build run with EMAIL_DEV_OUTBOX=1 (CI end to end tests only). The tests read
// magic links from it. A real production deploy without a key fails loudly instead.
export const DEV_OUTBOX = path.join(os.tmpdir(), 'mde-dev-outbox.jsonl')

// Every email has a plain text version and the legal entity in the footer (03_SYSTEMS.md section 9).
// Subjects never contain money amounts or reasons.
export function withFooter(email: Email): Email {
  const { legalEntity } = brand()
  return {
    ...email,
    text: `${email.text}\n\n--\n${legalEntity}`,
    html: `${email.html}<hr style="border:0;border-top:1px solid #E0D6C6;margin:32px 0 16px"><p style="font:13px Archivo,Arial,sans-serif;color:#6E675C">${escapeHtml(legalEntity)}</p>`,
  }
}

export async function sendEmail(input: Email) {
  const e = env()
  const email = withFooter(input)
  if (!e.EMAIL_API_KEY) {
    if (process.env.NODE_ENV === 'production' && process.env.EMAIL_DEV_OUTBOX !== '1')
      throw new Error('EMAIL_API_KEY is not set')
    fs.appendFileSync(DEV_OUTBOX, JSON.stringify({ ...email, at: new Date().toISOString() }) + '\n')
    console.log(
      JSON.stringify({ level: 'info', msg: 'dev email written to outbox', to: email.to, subject: email.subject }),
    )
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${e.EMAIL_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: e.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  })
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`)
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
