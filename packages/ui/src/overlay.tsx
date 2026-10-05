'use client'

import * as RDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { bare, cn, focusRing } from './cn'

type Props = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  /** One primary action, bottom right. */
  footer?: ReactNode
  /** App screens: the viewer's theme. Overlays render outside the themed frame, so they carry it. */
  theme?: 'dark' | 'glass'
}

// Paper by default; on app screens the theme's popover surface, text and hairlines.
const surface = (theme: Props['theme']) =>
  theme
    ? 'bg-[var(--t-pop)] backdrop-blur-[24px] font-app text-[var(--t-text)] border border-solid border-[var(--t-glass-line)] shadow-[0_40px_100px_rgba(0,0,0,0.45)]'
    : 'bg-[#FBF7F0] font-sans text-ink shadow-[0_32px_80px_rgba(26,21,16,0.14)]'
const line = (theme: Props['theme']) => (theme ? 'border-[var(--t-hair)]' : 'border-line')
const mutedText = (theme: Props['theme']) => (theme ? 'text-[var(--t-muted)]' : 'text-muted-2')
const titleFont = (theme: Props['theme']) =>
  theme ? 'font-app text-[26px] font-bold tracking-[-0.01em]' : 'font-serif text-[28px] font-normal'

const overlay =
  'fixed inset-0 z-40 bg-[rgba(26,21,16,0.28)] data-[state=open]:animate-[mde-fade_220ms_cubic-bezier(0.2,0.7,0.2,1)]'

function Close({ className, theme }: { className?: string; theme?: Props['theme'] }) {
  return (
    <RDialog.Close
      aria-label="Close"
      className={cn(
        bare,
        focusRing,
        'flex size-11 cursor-pointer items-center justify-center rounded-full',
        theme ? 'text-[var(--t-muted)] hover:text-[var(--t-text)]' : 'text-muted-2 hover:text-ink',
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </RDialog.Close>
  )
}

// Centred dialog: 24px radius, the dialog shadow, serif title, one primary action at the bottom right.
export function Dialog({ open, onOpenChange, trigger, title, description, children, footer, theme }: Props) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          data-theme={theme}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 box-border w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
            'rounded-card p-8 outline-none',
            surface(theme),
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <RDialog.Title className={cn('m-0 leading-[1.1]', titleFont(theme))}>{title}</RDialog.Title>
            <Close className="-mt-2 -mr-3" theme={theme} />
          </div>
          {description ? (
            <RDialog.Description className={cn('mt-2 mb-0 text-[15px] leading-normal', mutedText(theme))}>
              {description}
            </RDialog.Description>
          ) : (
            <RDialog.Description className="sr-only">{title}</RDialog.Description>
          )}
          {children ? <div className="mt-6">{children}</div> : null}
          {footer ? <div className="mt-8 flex justify-end gap-3">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

// Right drawer, 560px wide, 28px radius on the inside corners, hairline-separated sections.
export function Drawer({ open, onOpenChange, trigger, title, description, children, footer, theme }: Props) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          data-theme={theme}
          className={cn(
            'fixed top-0 right-0 bottom-0 z-50 box-border flex w-[min(560px,100vw)] flex-col overflow-y-auto',
            'rounded-l-[28px] outline-none',
            surface(theme),
            'data-[state=open]:animate-[mde-slide_220ms_cubic-bezier(0.2,0.7,0.2,1)]',
          )}
        >
          <div
            className={cn(
              'flex items-start justify-between gap-4 border-0 border-b border-solid px-8 pt-8 pb-6',
              line(theme),
            )}
          >
            <div>
              <RDialog.Title className={cn('m-0 leading-[1.1]', titleFont(theme))}>{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className={cn('mt-2 mb-0 text-[13px]', mutedText(theme))}>
                  {description}
                </RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <Close className="-mt-2 -mr-3" theme={theme} />
          </div>
          <div className="flex-1 px-8">{children}</div>
          {footer ? (
            <div className={cn('flex justify-end gap-3 border-0 border-t border-solid px-8 py-6', line(theme))}>
              {footer}
            </div>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** A section inside a drawer, separated by a hairline. */
export function DrawerSection({ title, children, app }: { title: string; children: ReactNode; app?: boolean }) {
  return (
    <section
      className={cn(
        'border-0 border-b border-solid py-6 last:border-b-0',
        app ? 'border-[var(--t-hair)]' : 'border-line',
      )}
    >
      <h3 className={cn('m-0 mb-3 text-[13px] font-normal', app ? 'text-[var(--t-muted)]' : 'text-muted-2')}>
        {title}
      </h3>
      {children}
    </section>
  )
}
