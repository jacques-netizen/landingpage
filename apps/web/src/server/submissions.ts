import 'server-only'
import { REASON_CODES } from '@mde/config'
import { db, tables } from '@mde/db'
import { accessTokenFor, type LinkedAccount } from '@mde/platforms'
import { youtubeLogin } from './youtube'

/** The creator message for each reason code, as staff last worded it (03_SYSTEMS.md section 5). */
export async function reasonMessages(): Promise<Record<string, string>> {
  const rows = await db().select().from(tables.reasonCodes)
  const out: Record<string, string> = Object.fromEntries(REASON_CODES.map(([code, , message]) => [code, message]))
  for (const r of rows) out[r.code] = r.creatorMessage
  return out
}

/** An access token for an account linked by YouTube login, refreshed when needed. */
export async function tokenFor(account: LinkedAccount) {
  const login = youtubeLogin()
  if (!login || account.platform !== 'youtube') return null
  return accessTokenFor(db(), account, { client: login.client, encryptionKey: login.encryptionKey })
}
