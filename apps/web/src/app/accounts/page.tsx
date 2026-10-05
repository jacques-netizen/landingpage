import type { Metadata } from 'next'
import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { db, getSettings } from '@mde/db'
import { listAccounts, profileUrl, type Platform } from '@mde/platforms'
import { EmptyState } from '@mde/ui'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppFrame } from '@/components/app-frame'
import { AppHeading, panel, StatusDot } from '@/components/app-ui'
import { LocalDateTime } from '@/components/local-time'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { getViewer } from '@/server/viewer'
import { AccountActions, AddAccount } from './account-forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Accounts | Maison d'Élites" }

const count = (n: number) => n.toLocaleString('en-US')

// Linked accounts: platform, handle, status, followers, last checked; add and remove (01_PRODUCT.md 8.2).
// Not in the mockups, so it is built in the campaign page's style.
export default async function AccountsPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/accounts')
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const [accounts, s] = await Promise.all([listAccounts(db(), viewer.id), getSettings(db())])
  const now = new Date()
  const full = accounts.length >= s.max_linked_accounts

  return (
    <AppFrame theme={theme} active="accounts" signedIn>
      <AppHeading
        title="Accounts"
        lead={`Link the accounts you post from. Posts count only from verified accounts. You can link up to ${s.max_linked_accounts}.`}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-4 max-lg:grid-cols-1">
        <section className={`${panel} p-6 max-sm:p-4`} aria-label="Your accounts">
          {accounts.length === 0 ? (
            <EmptyState tone="app" title="No accounts linked yet." body="Add the first account you post from." />
          ) : (
            <ul className="m-0 list-none p-0">
              {accounts.map((a) => {
                const platform = a.platform as Platform
                const expired = !!a.verificationExpiresAt && a.verificationExpiresAt <= now
                return (
                  <li key={a.id} className="border-0 border-b border-solid border-[var(--t-hair)] py-5 last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[var(--t-muted)]">
                          {PLATFORM_LABELS[platform] ?? platform}
                        </div>
                        <a
                          href={profileUrl(platform, a.handle)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[18px] font-bold break-all text-[var(--t-text)] no-underline hover:text-[var(--t-accent-ink)]"
                        >
                          @{a.handle}
                        </a>
                      </div>
                      {a.status === 'verified' ? (
                        <StatusDot tone="good">Verified</StatusDot>
                      ) : a.status === 'failed' ? (
                        <StatusDot tone="bad">Needs attention</StatusDot>
                      ) : expired ? (
                        <StatusDot tone="bad">Code expired</StatusDot>
                      ) : (
                        <StatusDot tone="wait">Waiting for the code</StatusDot>
                      )}
                    </div>
                    {a.status === 'verified' ? (
                      <dl className="mt-3 mb-0 flex flex-wrap gap-x-8 gap-y-1 text-[13px]">
                        <div className="flex gap-2">
                          <dt className="text-[var(--t-muted)]">Followers</dt>
                          <dd className="m-0 font-semibold tabular-nums">
                            {a.followers === null ? 'Not shown' : count(a.followers)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-[var(--t-muted)]">Last checked</dt>
                          <dd className="m-0 font-semibold">
                            {a.lastCheckedAt ? <LocalDateTime iso={a.lastCheckedAt.toISOString()} /> : 'Not yet'}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                    <AccountActions
                      id={a.id}
                      theme={theme === 'light' ? 'glass' : 'dark'}
                      handle={a.handle}
                      pending={a.status !== 'verified'}
                      expired={expired}
                      code={a.verificationCode}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <aside className={`${panel} p-6 max-sm:p-4`}>
          <h2 className="m-0 text-[22px] font-bold tracking-[-0.01em]">Add an account</h2>
          {full ? (
            <p className="mt-3 mb-0 text-[14px] text-[var(--t-muted)]">
              You have linked {s.max_linked_accounts} accounts, the most allowed. Remove one to add another.
            </p>
          ) : (
            <>
              <p className="mt-2 mb-5 text-[14px] leading-[1.5] text-[var(--t-muted)]">
                We give you a short code. Put it in your public bio, then press Verify.
              </p>
              <AddAccount />
            </>
          )}
        </aside>
      </div>
    </AppFrame>
  )
}
