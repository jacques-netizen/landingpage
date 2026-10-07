import type { ReactNode } from 'react'

// Staff page header: title in the serif page size, one line of description (05_DESIGN_SYSTEM.md section 8).
export function AdminPage({
  title,
  lead,
  actions,
  children,
}: {
  title: string
  lead?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-[1080px] px-10 py-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="m-0 font-app text-[24px] font-bold tracking-[-0.01em]">{title}</h1>
          {lead ? <p className="mt-1 mb-0 text-[13px] text-muted-2">{lead}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  )
}

export function Notice({ kind, children }: { kind: 'ok' | 'bad'; children: ReactNode }) {
  return (
    <p
      role={kind === 'bad' ? 'alert' : 'status'}
      className={
        kind === 'bad'
          ? 'm-0 mb-6 rounded-input border border-solid border-[rgba(179,38,30,0.35)] bg-[rgba(179,38,30,0.06)] px-4 py-3 text-[14px] text-bad'
          : 'm-0 mb-6 rounded-input border border-solid border-[rgba(47,125,79,0.35)] bg-[rgba(47,125,79,0.07)] px-4 py-3 text-[14px] text-ok-ink'
      }
    >
      {children}
    </p>
  )
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return (
    <a
      href={href}
      className={
        variant === 'primary'
          ? 'inline-flex h-10 items-center rounded-pill bg-ink px-5 text-[13px] font-medium text-white no-underline hover:text-white'
          : 'inline-flex h-10 items-center rounded-pill border border-solid border-sand bg-field px-5 text-[13px] font-medium text-ink no-underline'
      }
    >
      {children}
    </a>
  )
}
