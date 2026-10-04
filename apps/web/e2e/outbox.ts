import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// The dev outbox the app writes to when no EMAIL_API_KEY is set (src/server/email.ts).
const OUTBOX = path.join(os.tmpdir(), 'mde-dev-outbox.jsonl')

type Mail = { to: string; subject: string; text: string }

export function mailsTo(to: string): Mail[] {
  if (!fs.existsSync(OUTBOX)) return []
  return fs
    .readFileSync(OUTBOX, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Mail)
    .filter((m) => m.to === to)
}

export async function latestLink(to: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const m = mailsTo(to).pop()
    const link = m?.text.match(/https?:\/\/\S+/)?.[0]
    if (link) return link
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`No email with a link for ${to}`)
}
