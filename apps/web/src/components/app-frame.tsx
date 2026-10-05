import type { ReactNode } from 'react'
import type { ThemeName } from '@/designed/themes'

// The app screens' frame, taken from the campaigns screen mockup: themed page background, a glass frame
// 1240px wide, and the left column with the wordmark and Home, Campaigns, Wallet. Used for app screens
// the mockups do not show, so they look like they belong to the same design. Signed-in creators also
// get My campaigns, Submissions, Accounts and Notifications below a hairline; the designed screens' own columns are unchanged.
export type AppSection = 'home' | 'campaigns' | 'wallet' | 'my-campaigns' | 'accounts' | 'submissions' | 'notifications'

export function AppFrame({
  theme,
  active,
  signedIn = false,
  children,
}: {
  theme: ThemeName
  active: AppSection
  signedIn?: boolean
  children: ReactNode
}) {
  const main = [
    ['home', 'Home', '/'],
    ['campaigns', 'Campaigns', '/campaigns'],
    ['wallet', 'Wallet', '/wallet'],
  ] as const
  const mine = [
    ['my-campaigns', 'My campaigns', '/my-campaigns'],
    ['submissions', 'Submissions', '/submissions'],
    ['accounts', 'Accounts', '/accounts'],
    ['notifications', 'Notifications', '/notifications'],
  ] as const
  const link = ([key, label, href]: readonly [AppSection, string, string]) => (
    <a
      key={key}
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className="flex h-[42px] items-center rounded-[12px] px-[14px] text-[14px] font-semibold no-underline"
      style={{
        background: active === key ? 'rgba(216,197,143,0.2)' : 'transparent',
        color: active === key ? 'var(--t-accent-ink)' : 'var(--t-muted)',
      }}
    >
      {label}
    </a>
  )
  return (
    <div
      data-theme={theme === 'light' ? 'glass' : 'dark'}
      className="box-border min-h-screen px-6 pt-10 pb-24 font-app text-[var(--t-text)] max-sm:px-3 max-sm:pt-4"
      style={{ background: 'var(--t-page)' }}
    >
      <div className="mx-auto box-border flex max-w-[1240px] gap-4 rounded-[38px] border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] p-4 shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-[20px] max-sm:flex-col max-sm:rounded-[28px] max-sm:p-[10px]">
        <nav
          aria-label="Main"
          className="box-border flex w-[220px] flex-none flex-col gap-[6px] rounded-[26px] border border-solid border-[var(--t-hair)] bg-[var(--t-side)] px-4 py-[22px] max-sm:w-auto max-sm:flex-row max-sm:flex-wrap max-sm:rounded-[22px]"
        >
          <a href="/" className="mx-[6px] mt-1 mb-[22px] block max-sm:mb-3 max-sm:basis-full">
            <img
              src="/designed/logo-nav-clear.png"
              alt="Maison d'Élites"
              className="block h-6 w-auto max-w-full object-contain object-left"
              style={{ filter: 'var(--t-logo-filter)' }}
            />
          </a>
          {main.map(link)}
          {signedIn ? (
            <>
              <span
                aria-hidden
                className="mx-[6px] my-3 block h-px bg-[var(--t-hair)] max-sm:mx-1 max-sm:my-0 max-sm:h-auto max-sm:w-px"
              />
              {mine.map(link)}
            </>
          ) : null}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
