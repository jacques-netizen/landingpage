import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export function PageContainer({
  width = 'public',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { width?: 'public' | 'app' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-6',
        width === 'public' ? 'max-w-[1200px]' : 'max-w-[1280px]',
        className,
      )}
      {...props}
    />
  )
}

export function PageTitle({
  title,
  description,
  size = 'lg',
  action,
}: {
  title: string
  description?: string
  size?: 'lg' | 'sm'
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className={cn('font-display', size === 'lg' ? 'text-display-lg' : 'text-display-sm')}>
          {title}
        </h1>
        {description && <p className="text-body-lg text-ink-2">{description}</p>}
      </div>
      {action}
    </div>
  )
}

type FooterLink = { href: string; label: string }

/** Footer shows the legal entity from config. No invented claims. */
export function Footer({
  brandName,
  legalEntity,
  links,
}: {
  brandName: string
  legalEntity: string
  links: FooterLink[]
}) {
  return (
    <footer className="mt-32 border-t border-line">
      <PageContainer className="flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-display text-display-sm">{brandName}</span>
          <span className="text-body-sm text-ink-2">{legalEntity}</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center text-body-sm text-ink-2 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </PageContainer>
    </footer>
  )
}
