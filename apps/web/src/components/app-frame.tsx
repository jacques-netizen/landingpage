import type { ReactNode } from 'react'
import type { ThemeName } from '@/designed/themes'
import { AppMenu, type AppSection } from './app-menu'

// The app screens' frame, taken from the campaigns screen mockup: themed page background, a glass frame
// 1240px wide, and the left column with the app's one menu (see app-menu.tsx). Used for the wallet and
// for app screens the mockups do not show, so every screen has the same menu in the same place.
export type { AppSection } from './app-menu'

export function AppFrame({
  theme,
  active,
  signedIn = false,
  children,
}: {
  theme: ThemeName
  active: AppSection | null
  signedIn?: boolean
  children: ReactNode
}) {
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
          <AppMenu active={active} signedIn={signedIn} />
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
