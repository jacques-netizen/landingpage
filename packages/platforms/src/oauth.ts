// Official login for linking (03_SYSTEMS.md 2.2). YouTube through Google OAuth with the read-only scope.
import { getSettings, tables, writeAudit, type Db } from '@mde/db'
import { and, eq, ne, sql } from 'drizzle-orm'
import { AccountError, listAccounts, type LinkedAccount } from './accounts'
import { decryptTokens, encryptTokens, type OAuthTokens } from './tokens'
import type { Platform, ProfileData } from './types'
import { normalizeHandle } from './urls'
import { YOUTUBE_SCOPE } from './youtube'

const { linkedAccounts } = tables

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export type GoogleClient = {
  clientId: string
  clientSecret: string
  redirectUri: string
  /** Only tests point this elsewhere. */
  tokenUrl?: string
}
type Fetch = typeof fetch

export function googleAuthUrl(client: Pick<GoogleClient, 'clientId' | 'redirectUri'>, state: string) {
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', client.clientId)
  url.searchParams.set('redirect_uri', client.redirectUri)
  url.searchParams.set('response_type', 'code')
  // The smallest scope that gives views.
  url.searchParams.set('scope', YOUTUBE_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'false')
  url.searchParams.set('state', state)
  return url.toString()
}

async function tokenRequest(
  http: Fetch,
  client: GoogleClient,
  body: Record<string, string>,
  now: Date,
): Promise<OAuthTokens> {
  const res = await http(client.tokenUrl ?? GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  if (!res.ok) throw new Error(`Google token endpoint returned ${res.status}`)
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number }
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresAt: t.expires_in ? new Date(now.getTime() + t.expires_in * 1000).toISOString() : null,
  }
}

export function exchangeGoogleCode(client: GoogleClient, code: string, http: Fetch = fetch, now = new Date()) {
  return tokenRequest(
    http,
    client,
    {
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
      grant_type: 'authorization_code',
    },
    now,
  )
}

/** Link (or relink) an account the creator proved through official login. */
export async function linkOAuthAccount(
  db: Db,
  creatorId: string,
  input: { platform: Platform; profile: ProfileData; tokens: OAuthTokens; encryptionKey: string },
  now = new Date(),
): Promise<LinkedAccount> {
  const { platform, profile } = input
  const s = await getSettings(db)
  const values = {
    status: 'verified',
    linkMethod: 'oauth',
    platformUserId: profile.platformUserId,
    handle: normalizeHandle(profile.handle),
    followers: profile.followers,
    accountCreatedAt: profile.createdAt,
    verifiedAt: now,
    lastCheckedAt: now,
    verificationCode: null,
    verificationExpiresAt: null,
    tokenCiphertext: encryptTokens(input.tokens, input.encryptionKey),
  }
  const [owner] = await db
    .select({ id: linkedAccounts.id, creatorId: linkedAccounts.creatorId })
    .from(linkedAccounts)
    .where(
      and(
        eq(linkedAccounts.platform, platform),
        eq(linkedAccounts.platformUserId, profile.platformUserId),
        ne(linkedAccounts.status, 'removed'),
      ),
    )
  if (owner && owner.creatorId !== creatorId) {
    await writeAudit(db, {
      actorId: creatorId,
      action: 'linked_account.conflict',
      entity: 'linked_account',
      entityId: owner.id,
      after: { platform, handle: values.handle, platformUserId: profile.platformUserId, method: 'oauth' },
    })
    throw new AccountError(
      'linked_elsewhere',
      'This account is already linked to another creator. Our team has been told and will look into it.',
    )
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'linked_accounts:' + creatorId}))`)
    if (owner) {
      const [updated] = await tx.update(linkedAccounts).set(values).where(eq(linkedAccounts.id, owner.id)).returning()
      return updated!
    }
    // A pending bio code entry for the same handle becomes this account instead of a second row.
    const current = await listAccounts(tx, creatorId)
    const pendingSame = current.find(
      (a) => a.platform === platform && a.handle === values.handle && a.status !== 'verified',
    )
    if (pendingSame) {
      const [updated] = await tx
        .update(linkedAccounts)
        .set(values)
        .where(eq(linkedAccounts.id, pendingSame.id))
        .returning()
      return updated!
    }
    if (current.length >= s.max_linked_accounts)
      throw new AccountError(
        'limit_reached',
        `You can link up to ${s.max_linked_accounts} accounts. Remove one to add another.`,
      )
    const [row] = await tx
      .insert(linkedAccounts)
      .values({ creatorId, platform, ...values })
      .returning()
    return row!
  })
}

/**
 * A usable access token for an OAuth account, refreshed shortly before it expires. If the refresh
 * fails the account is marked failed and null is returned, so callers fall back to public data.
 */
export async function accessTokenFor(
  db: Db,
  account: LinkedAccount,
  deps: { client: GoogleClient; encryptionKey: string; http?: Fetch; now?: Date },
): Promise<string | null> {
  if (account.linkMethod !== 'oauth' || !account.tokenCiphertext) return null
  const now = deps.now ?? new Date()
  const tokens = decryptTokens(account.tokenCiphertext, deps.encryptionKey)
  if (!tokens.expiresAt || new Date(tokens.expiresAt).getTime() - now.getTime() > 60_000) return tokens.accessToken
  try {
    if (!tokens.refreshToken) throw new Error('no refresh token')
    const fresh = await tokenRequest(
      deps.http ?? fetch,
      deps.client,
      {
        refresh_token: tokens.refreshToken,
        client_id: deps.client.clientId,
        client_secret: deps.client.clientSecret,
        grant_type: 'refresh_token',
      },
      now,
    )
    const next = { ...fresh, refreshToken: fresh.refreshToken ?? tokens.refreshToken }
    await db
      .update(linkedAccounts)
      .set({ tokenCiphertext: encryptTokens(next, deps.encryptionKey) })
      .where(eq(linkedAccounts.id, account.id))
    return next.accessToken
  } catch {
    await db.update(linkedAccounts).set({ status: 'failed' }).where(eq(linkedAccounts.id, account.id))
    return null
  }
}
