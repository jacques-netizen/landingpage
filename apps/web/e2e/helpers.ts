import { readFileSync } from 'node:fs'
import postgres from 'postgres'

export const TEST_DB =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/mde_test'

/** Latest sign in link sent to an address, read from the dev outbox. */
export async function latestLink(to: string, timeoutMs = 10_000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const lines = readFileSync('/tmp/mde-e2e-outbox.jsonl', 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
      const mails = lines
        .map((l) => JSON.parse(l) as { to: string; text: string })
        .filter((m) => m.to === to)
      const last = mails.at(-1)
      const url = last?.text.match(/https?:\/\/\S+/)?.[0]
      if (url) return url
    } catch {
      // file not written yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`No email for ${to}`)
}

export function sql() {
  return postgres(TEST_DB, { max: 1, onnotice: () => {} })
}
