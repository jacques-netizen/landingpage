import type { ReactNode } from 'react'
import { cn } from './cn'

type NavLink = { label: string; href: string; active?: boolean }

// The public nav from the mockups: wordmark left, hairline pill of links centred, black pill right.
// The active link sits in the ink pill, as on the brand site ("For brands").
export function PublicNav({
  links,
  cta,
  logoSrc = '/designed/logo-nav-clear.png',
}: {
  links: NavLink[]
  cta: { label: string; href: string }
  logoSrc?: string
}) {
  return (
    <nav
      aria-label="Main"
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-12 py-[30px] font-sans max-sm:grid-cols-[1fr_auto] max-sm:gap-y-4 max-sm:px-4 max-sm:py-5"
    >
      <a href="/" className="justify-self-start">
        <img
          src={logoSrc}
          alt="Maison d'Élites"
          className="block h-[26px] w-auto max-w-full object-contain object-left"
        />
      </a>
      <div className="flex gap-[6px] rounded-pill border border-solid border-line bg-[rgba(255,255,255,0.55)] px-2 py-[5px] text-[13px] max-sm:col-span-2 max-sm:row-start-2 max-sm:justify-self-center">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            aria-current={l.active ? 'page' : undefined}
            className={cn(
              'rounded-pill px-4 py-[9px] no-underline',
              l.active ? 'bg-ink text-white hover:text-white' : 'text-ink',
            )}
          >
            {l.label}
          </a>
        ))}
      </div>
      <a
        href={cta.href}
        className="flex h-11 items-center gap-2 justify-self-end rounded-pill max-sm:col-start-2 max-sm:row-start-1 bg-ink px-[22px] text-[13px] font-medium text-white no-underline hover:text-white"
      >
        {cta.label} <span aria-hidden>↗</span>
      </a>
    </nav>
  )
}

export function PageContainer({
  children,
  app,
  className,
}: {
  children: ReactNode
  app?: boolean
  className?: string
}) {
  return (
    <div className={cn('mx-auto box-border px-6', app ? 'max-w-[1280px]' : 'max-w-[1200px]', className)}>
      {children}
    </div>
  )
}

type FooterColumn = { title: string; links: { label: string; href?: string }[] }

// The brand site footer from the mockups.
export function Footer({
  columns,
  legalLine,
  logoSrc = '/designed/logo-nav-clear.png',
}: {
  columns: FooterColumn[]
  legalLine: string
  logoSrc?: string
}) {
  return (
    <footer className="bg-night font-sans text-cream">
      <div className="mx-auto max-w-[1240px] px-6 pt-16 pb-10">
        <div className="flex flex-wrap justify-between gap-12">
          <img src={logoSrc} alt="Maison d'Élites" className="h-[26px] w-auto brightness-0 invert" />
          <div className="flex flex-wrap gap-24 text-[15px] text-[rgba(244,241,234,0.7)]">
            {columns.map((c) => (
              <div key={c.title} className="flex flex-col gap-[14px]">
                <div className="text-[17px] font-semibold text-cream">{c.title}</div>
                {c.links.map((l) =>
                  l.href ? (
                    <a
                      key={l.label}
                      href={l.href}
                      className="text-[rgba(244,241,234,0.7)] no-underline hover:text-cream"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <span key={l.label}>{l.label}</span>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 text-[14px] text-[rgba(244,241,234,0.55)]">{legalLine}</div>
      </div>
    </footer>
  )
}

// Staff admin: a left column of plain text links, active in ink, others in the secondary colour.
export function AdminNav({ links, logoSrc = '/designed/logo-nav-clear.png' }: { links: NavLink[]; logoSrc?: string }) {
  return (
    <nav
      aria-label="Admin"
      className="box-border flex w-[200px] flex-none flex-col gap-[14px] border-0 border-r border-solid border-line px-6 py-8 font-sans text-[15px] text-muted-2"
    >
      <a href="/admin" className="mb-3 block">
        <img src={logoSrc} alt="Maison d'Élites" className="block h-auto w-[152px]" />
      </a>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          aria-current={l.active ? 'page' : undefined}
          className={cn('no-underline', l.active ? 'font-medium text-ink' : 'text-muted-2')}
        >
          {l.label}
        </a>
      ))}
    </nav>
  )
}

// The four-point star ornament used in the mockups.
export function Star({ size = 18, color = '#1A1510' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <path d="M9 0 L10.8 7.2 L18 9 L10.8 10.8 L9 18 L7.2 10.8 L0 9 L7.2 7.2 Z" fill={color} />
    </svg>
  )
}
