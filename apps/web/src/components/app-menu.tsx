import { signOutAction } from '@/app/(auth)/actions'
import { ACCOUNT_LINKING } from '@/lib/features'

// The creator app's one menu (owner request and testing report, 2026-10-07): the same items, in the
// same place, on every app screen, drawn in the campaigns screen's sidebar style.
export type AppSection =
  | 'home'
  | 'campaigns'
  | 'my-campaigns'
  | 'wallet'
  | 'leaderboard'
  | 'support'
  | 'submissions'
  | 'accounts'
  | 'notifications'

type Item = readonly [AppSection, string, string]

export function AppMenu({ active, signedIn }: { active: AppSection | null; signedIn: boolean }) {
  const main: Item[] = [
    ['home', 'Home', signedIn ? '/dashboard' : '/'],
    ['campaigns', 'Campaigns', '/campaigns'],
    ...(signedIn ? ([['my-campaigns', 'My campaigns', '/my-campaigns']] as Item[]) : []),
    ['wallet', 'Wallet', '/wallet'],
    ['leaderboard', 'Leaderboard', '/leaderboard'],
    ['support', 'Support', '/help'],
  ]
  const mine: Item[] = signedIn
    ? [
        ['submissions', 'Submissions', '/submissions'],
        ...(ACCOUNT_LINKING ? ([['accounts', 'Accounts', '/accounts']] as Item[]) : []),
        ['notifications', 'Notifications', '/notifications'],
      ]
    : []
  const link = ([key, label, href]: Item) => (
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
    <>
      <a href={signedIn ? '/campaigns' : '/'} className="mx-[6px] mt-1 mb-[22px] block max-sm:mb-3 max-sm:basis-full">
        <img
          src="/designed/logo-nav-clear.png"
          alt="Maison d'Élites"
          className="block h-6 w-auto max-w-full object-contain object-left"
          style={{ filter: 'var(--t-logo-filter)' }}
        />
      </a>
      {main.map(link)}
      {mine.length ? (
        <>
          <span
            aria-hidden
            className="mx-[6px] my-3 block h-px bg-[var(--t-hair)] max-sm:mx-1 max-sm:my-0 max-sm:h-auto max-sm:w-px"
          />
          {mine.map(link)}
        </>
      ) : null}
      {signedIn ? (
        // Sign out sits at the bottom of the menu (owner request, 2026-10-07).
        <form action={signOutAction} className="mt-auto pt-3 max-sm:mt-0 max-sm:pt-0">
          <button
            type="submit"
            className="flex h-[42px] w-full cursor-pointer items-center rounded-[12px] border-0 bg-transparent px-[14px] text-left font-app text-[14px] font-semibold text-[var(--t-muted)] hover:text-[var(--t-text)]"
          >
            Sign out
          </button>
        </form>
      ) : null}
    </>
  )
}
