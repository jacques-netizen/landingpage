import { db, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { parseWhop } from '@/lib/crypto-wallets'
import { limitVisitor } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'
import { accountReady, getAccount, WhopError } from '@/server/whop'

// Where Whop sends the clipper back after its identity check (owner, 2026-11-24). Asks Whop whether
// the account is ready and, if so, marks the payout method verified so they can withdraw.
export async function GET(req: NextRequest) {
  const limited = await limitVisitor('whop-return', 30, 3600)
  if (limited) return limited
  const back = (q: string) => NextResponse.redirect(new URL(`/wallet?whop=${q}`, req.url), 303)
  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL('/sign-in?next=/wallet', req.url), 303)
  const [p] = await db()
    .select({ ref: tables.creatorProfiles.payoutProviderRef, status: tables.creatorProfiles.payoutStatus })
    .from(tables.creatorProfiles)
    .where(eq(tables.creatorProfiles.userId, viewer.id))
  const accountId = parseWhop(p?.ref)
  if (!accountId) return back('none')
  try {
    const ready = accountReady(await getAccount(accountId))
    const status = ready ? 'verified' : 'pending'
    if (p!.status !== status)
      await db()
        .update(tables.creatorProfiles)
        .set({ payoutStatus: status, updatedAt: new Date() })
        .where(eq(tables.creatorProfiles.userId, viewer.id))
    return back(ready ? 'ready' : 'pending')
  } catch (e) {
    if (e instanceof WhopError) return back('pending')
    throw e
  }
}
