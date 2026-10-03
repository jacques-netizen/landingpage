'use client'
import type { ReactNode } from 'react'
import { Dialog as RxDialog } from 'radix-ui'
import { cn } from './cn'
import { Close } from './icons'

export const DialogRoot = RxDialog.Root
export const DialogTrigger = RxDialog.Trigger
export const DialogClose = RxDialog.Close

function Overlay() {
  return (
    <RxDialog.Overlay className="mde-fade fixed inset-0 z-40 bg-ink/30 data-[state=closed]:opacity-0" />
  )
}

function CloseButton() {
  return (
    <RxDialog.Close
      aria-label="Close"
      className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-ink/5 hover:text-ink"
    >
      <Close size={18} />
    </RxDialog.Close>
  )
}

/** Centred dialog. One primary action sits at the bottom right, passed as `actions`. */
export function Dialog({
  title,
  description,
  children,
  actions,
  open,
  onOpenChange,
  trigger,
}: {
  title: string
  description?: string
  children?: ReactNode
  actions?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
}) {
  return (
    <RxDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RxDialog.Trigger asChild>{trigger}</RxDialog.Trigger>}
      <RxDialog.Portal>
        <Overlay />
        <RxDialog.Content
          className={cn(
            'mde-pop fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2',
            'rounded-card bg-surface p-8 shadow-dialog data-[state=closed]:opacity-0',
          )}
        >
          <RxDialog.Title className="font-display text-display-sm pr-10">{title}</RxDialog.Title>
          {description ? (
            <RxDialog.Description className="mt-2 text-body text-ink-2">
              {description}
            </RxDialog.Description>
          ) : (
            <RxDialog.Description className="sr-only">{title}</RxDialog.Description>
          )}
          {children && <div className="mt-6">{children}</div>}
          {actions && <div className="mt-8 flex items-center justify-end gap-3">{actions}</div>}
          <CloseButton />
        </RxDialog.Content>
      </RxDialog.Portal>
    </RxDialog.Root>
  )
}

/** Right drawer, 560px wide, rounded on the inside corners. */
export function Drawer({
  title,
  description,
  children,
  open,
  onOpenChange,
  trigger,
}: {
  title: string
  description?: string
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
}) {
  return (
    <RxDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RxDialog.Trigger asChild>{trigger}</RxDialog.Trigger>}
      <RxDialog.Portal>
        <Overlay />
        <RxDialog.Content
          className={cn(
            'mde-slide fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[560px] flex-col overflow-y-auto',
            'rounded-l-drawer bg-surface p-8 shadow-dialog data-[state=closed]:translate-x-full',
          )}
        >
          <RxDialog.Title className="font-display text-display-sm pr-10">{title}</RxDialog.Title>
          {description ? (
            <RxDialog.Description className="mt-2 text-body text-ink-2">
              {description}
            </RxDialog.Description>
          ) : (
            <RxDialog.Description className="sr-only">{title}</RxDialog.Description>
          )}
          <div className="mt-6 flex flex-col divide-y divide-line">{children}</div>
          <CloseButton />
        </RxDialog.Content>
      </RxDialog.Portal>
    </RxDialog.Root>
  )
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-6 first:pt-0">
      <h3 className="mb-3 text-label font-medium text-ink">{title}</h3>
      {children}
    </section>
  )
}
