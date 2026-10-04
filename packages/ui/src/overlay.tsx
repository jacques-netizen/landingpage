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
}

const overlay =
  'fixed inset-0 z-40 bg-[rgba(26,21,16,0.28)] data-[state=open]:animate-[mde-fade_220ms_cubic-bezier(0.2,0.7,0.2,1)]'

function Close({ className }: { className?: string }) {
  return (
    <RDialog.Close
      aria-label="Close"
      className={cn(
        bare,
        focusRing,
        'flex size-11 cursor-pointer items-center justify-center rounded-full text-muted-2 hover:text-ink',
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
export function Dialog({ open, onOpenChange, trigger, title, description, children, footer }: Props) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 box-border w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
            'rounded-card bg-[#FBF7F0] p-8 font-sans text-ink shadow-[0_32px_80px_rgba(26,21,16,0.14)] outline-none',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <RDialog.Title className="m-0 font-serif text-[28px] leading-[1.1] font-normal">{title}</RDialog.Title>
            <Close className="-mt-2 -mr-3" />
          </div>
          {description ? (
            <RDialog.Description className="mt-2 mb-0 text-[15px] leading-normal text-muted-2">
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
export function Drawer({ open, onOpenChange, trigger, title, description, children, footer }: Props) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          className={cn(
            'fixed top-0 right-0 bottom-0 z-50 box-border flex w-[min(560px,100vw)] flex-col overflow-y-auto',
            'rounded-l-[28px] bg-[#FBF7F0] font-sans text-ink shadow-[0_32px_80px_rgba(26,21,16,0.14)] outline-none',
            'data-[state=open]:animate-[mde-slide_220ms_cubic-bezier(0.2,0.7,0.2,1)]',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-0 border-b border-solid border-line px-8 pt-8 pb-6">
            <div>
              <RDialog.Title className="m-0 font-serif text-[28px] leading-[1.1] font-normal">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-2 mb-0 text-[13px] text-muted-2">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <Close className="-mt-2 -mr-3" />
          </div>
          <div className="flex-1 px-8">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-3 border-0 border-t border-solid border-line px-8 py-6">{footer}</div>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** A section inside a drawer, separated by a hairline. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-0 border-b border-solid border-line py-6 last:border-b-0">
      <h3 className="m-0 mb-3 text-[13px] font-normal text-muted-2">{title}</h3>
      {children}
    </section>
  )
}
