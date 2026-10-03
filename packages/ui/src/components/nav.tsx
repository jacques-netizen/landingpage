'use client'
import { useState, type ComponentType, type ReactNode } from 'react'
import { Dialog as RxDialog } from 'radix-ui'
import { cn } from './cn'
import { buttonClasses } from './button'
import { ArrowUpRight, Close, Menu } from './icons'

export type NavLink = { href: string; label: string; active?: boolean }
type LinkLike = ComponentType<{
  href: string
  className?: string
  children?: ReactNode
  'aria-current'?: 'page'
}>

const DefaultLink: LinkLike = ({ href, ...rest }) => <a href={href} {...rest} />

/** Centred hairline pill. The active link sits in a soft inner pill. */
export function NavPill({
  links,
  LinkComponent = DefaultLink,
}: {
  links: NavLink[]
  LinkComponent?: LinkLike
}) {
  return (
    <nav
      aria-label="Main"
      className="hidden items-center gap-1 rounded-pill border border-line bg-white/40 p-1 md:flex"
    >
      {links.map((l) => (
        <LinkComponent
          key={l.href}
          href={l.href}
          aria-current={l.active ? 'page' : undefined}
          className={cn(
            'inline-flex h-10 items-center rounded-pill px-4 text-body-sm text-ink transition-colors duration-150 ease-calm',
            l.active ? 'bg-ink/5' : 'hover:bg-ink/[0.03]',
          )}
        >
          {l.label}
        </LinkComponent>
      ))}
    </nav>
  )
}

/**
 * Top bar: wordmark left, nav pill centred, black pill button right.
 * On mobile the pill collapses to a menu button that opens a full screen sheet.
 */
export function SiteHeader({
  brandName,
  links,
  cta,
  right,
  LinkComponent = DefaultLink,
}: {
  brandName: string
  links: NavLink[]
  cta?: { href: string; label: string }
  /** Replaces the call to action, for example the avatar and balance in the creator app. */
  right?: ReactNode
  LinkComponent?: LinkLike
}) {
  const [open, setOpen] = useState(false)
  const Link = LinkComponent
  return (
    <header className="mx-auto grid w-full max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-6">
      <Link href="/" className="font-display text-display-sm justify-self-start text-ink">
        {brandName}
      </Link>
      <NavPill links={links} LinkComponent={Link} />
      <div className="col-start-3 flex items-center justify-end gap-3 md:col-start-auto">
        {right ??
          (cta && (
            <Link
              href={cta.href}
              className={buttonClasses({ size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              {cta.label}
              <ArrowUpRight size={14} />
            </Link>
          ))}
        <RxDialog.Root open={open} onOpenChange={setOpen}>
          <RxDialog.Trigger
            aria-label="Open menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-line-strong md:hidden"
          >
            <Menu size={18} />
          </RxDialog.Trigger>
          <RxDialog.Portal>
            <RxDialog.Content className="mde-fade fixed inset-0 z-50 flex flex-col bg-bg px-6 py-6">
              <RxDialog.Title className="sr-only">Menu</RxDialog.Title>
              <RxDialog.Description className="sr-only">Site navigation</RxDialog.Description>
              <div className="flex items-center justify-between">
                <span className="font-display text-display-sm">{brandName}</span>
                <RxDialog.Close
                  aria-label="Close menu"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-line-strong"
                >
                  <Close size={18} />
                </RxDialog.Close>
              </div>
              <nav aria-label="Mobile" className="mt-12 flex flex-col">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={l.active ? 'page' : undefined}
                    className="border-b border-line py-4 font-display text-display-md"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              {cta && (
                <Link href={cta.href} className={buttonClasses({ className: 'mt-8 self-start' })}>
                  {cta.label}
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </RxDialog.Content>
          </RxDialog.Portal>
        </RxDialog.Root>
      </div>
    </header>
  )
}

/** Staff admin: a left column of plain text links. */
export function AdminNav({
  links,
  LinkComponent = DefaultLink,
}: {
  links: NavLink[]
  LinkComponent?: LinkLike
}) {
  const Link = LinkComponent
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-11 items-center text-body transition-colors duration-150 ease-calm',
            l.active ? 'text-ink' : 'text-ink-2 hover:text-ink',
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
