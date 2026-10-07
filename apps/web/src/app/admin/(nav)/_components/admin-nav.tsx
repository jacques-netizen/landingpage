'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { signOutAction } from '@/app/(auth)/actions'

// The staff console sidebar, laid out like the Promote admin: logo, search, sections with icons, and the
// signed-in person at the bottom. Dark, with the brand's gold for the active item.
const I = {
  home: 'M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z',
  campaigns: 'M4 4h12v4H4zM4 10h7v6H4zM13 10h3v6h-3z',
  clients: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 0a2.5 2.5 0 1 0 0-5M2 17c0-3 2.2-5 5-5s5 2 5 5M13 12c2.5 0 5 1.6 5 5',
  review: 'M4 4h12v12H4zM7 10l2 2 4-4',
  creators: 'M10 9a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 10 9zM3.5 17.5c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6',
  appeals: 'M4 5h12v8H9l-4 3v-3H4z',
  ledger: 'M5 3h10v14H5zM8 7h4M8 10h4M8 13h2',
  payouts: 'M3 6h14v9H3zM3 9h14M6 13h3',
  brand: 'M4 15V5l6 3 6-3v10l-6 3z',
  team: 'M10 3l6 3v4c0 3.5-2.6 6.3-6 7-3.4-.7-6-3.5-6-7V6z',
  settings:
    'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4',
  audit: 'M5 3h7l3 3v11H5zM8 9h5M8 12h5',
}

const SECTIONS: { title?: string; links: [string, string, keyof typeof I][] }[] = [
  {
    links: [
      ['Overview', '/admin', 'home'],
      ['Campaigns', '/admin/campaigns', 'campaigns'],
      ['Review queue', '/admin/review', 'review'],
      ['Appeals', '/admin/appeals', 'appeals'],
      ['Creators', '/admin/creators', 'creators'],
    ],
  },
  {
    title: 'Business',
    links: [
      ['Clients', '/admin/clients', 'clients'],
      ['Ledger', '/admin/ledger', 'ledger'],
      ['Payouts', '/admin/payouts', 'payouts'],
      ['Brand site', '/admin/brand-site', 'brand'],
    ],
  },
  {
    title: 'Admin',
    links: [
      ['Team', '/admin/team', 'team'],
      ['Settings', '/admin/settings', 'settings'],
      ['Audit log', '/admin/audit-log', 'audit'],
    ],
  },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="flex-none">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function AdminSideNav({ email, role }: { email: string; role: string }) {
  const path = usePathname()
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return (
    <nav
      aria-label="Admin"
      className="sticky top-0 box-border flex h-screen w-[232px] flex-none flex-col border-0 border-r border-solid border-line bg-panel px-3 py-5 font-sans text-[13px]"
    >
      <a href="/admin" className="mb-5 block px-3">
        <img
          src="/designed/logo-nav-clear.png"
          alt="Maison d'Élites"
          className="block h-auto w-[136px]"
          style={{ filter: 'invert(1) brightness(1.6)' }}
        />
      </a>
      <form action="/admin/creators" role="search" className="mb-4 px-1">
        <label className="flex h-9 items-center gap-2 rounded-[10px] border border-solid border-line bg-field px-3 text-muted">
          <Icon d="M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM17 17l-3.5-3.5" />
          <input
            name="q"
            placeholder="Search creators"
            aria-label="Find a creator"
            className="w-full border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </label>
      </form>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {SECTIONS.map((s, i) => (
          <div key={i} className="flex flex-col gap-[2px]">
            {s.title ? (
              <span className="px-3 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                {s.title}
              </span>
            ) : null}
            {s.links.map(([label, href, icon]) => {
              const on = active(href)
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex h-9 items-center gap-3 rounded-[10px] px-3 no-underline ${
                    on
                      ? 'bg-[rgba(216,197,143,0.14)] font-medium text-gold-soft'
                      : 'text-muted-2 hover:bg-field hover:text-ink'
                  }`}
                >
                  <Icon d={I[icon]} />
                  {label}
                </a>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 border-0 border-t border-solid border-line px-2 pt-4">
        <span className="flex size-8 flex-none items-center justify-center rounded-full bg-gold-soft text-[13px] font-bold text-night">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{email}</span>
          <span className="block text-[12px] text-muted">{role}</span>
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="cursor-pointer border-0 bg-transparent p-1 text-[12px] text-muted hover:text-ink"
            title="Sign out"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}

export function AdminTopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-3 border-0 border-b border-solid border-line bg-page/90 px-8 backdrop-blur">
      {children}
      <a
        href="/campaigns"
        className="flex h-9 items-center gap-2 rounded-[10px] border border-solid border-[rgba(216,197,143,0.35)] bg-[rgba(216,197,143,0.1)] px-4 text-[13px] font-medium text-gold-soft no-underline"
      >
        <Icon d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />
        App
      </a>
    </header>
  )
}
