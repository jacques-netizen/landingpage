'use client'

import * as RToast from '@radix-ui/react-toast'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { bare, cn, focusRing, type Tone } from './cn'

type ToastItem = { id: number; message: string }
const ToastContext = createContext<(message: string) => void>(() => {})

// Black pill at the bottom centre, white text, one line, gone after 4 seconds.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const show = useCallback(
    (message: string) => setItems((s) => [...s, { id: Date.now() + Math.random(), message }]),
    [],
  )
  return (
    <ToastContext.Provider value={show}>
      <RToast.Provider duration={4000} swipeDirection="down">
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            onOpenChange={(open) => !open && setItems((s) => s.filter((x) => x.id !== t.id))}
            className="flex h-12 items-center rounded-pill bg-ink px-6 font-sans text-[14px] whitespace-nowrap text-white shadow-[0_20px_50px_rgba(26,21,16,0.18)] data-[state=open]:animate-[mde-rise_220ms_cubic-bezier(0.2,0.7,0.2,1)]"
          >
            <RToast.Title>{t.message}</RToast.Title>
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-6 left-1/2 z-[60] m-0 flex -translate-x-1/2 list-none flex-col items-center gap-2 p-0 outline-none" />
      </RToast.Provider>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

type NoticeProps = { children: ReactNode; onDismiss?: () => void; kind?: 'ok' | 'warn' | 'bad'; tone?: Tone }

// The wallet's confirmation banner ("Withdrawal requested ... Dismiss").
export function Notice({ children, onDismiss, kind = 'ok', tone = 'app' }: NoticeProps) {
  const colours = {
    ok: 'bg-[rgba(79,178,134,0.16)] border-[rgba(79,178,134,0.4)]',
    warn: 'bg-[rgba(224,169,74,0.16)] border-[rgba(224,169,74,0.45)]',
    bad: 'bg-[rgba(226,107,94,0.16)] border-[rgba(226,107,94,0.45)]',
  }[kind]
  return (
    <div
      role="status"
      className={cn(
        'box-border flex items-center justify-between gap-4 rounded-[16px] border border-solid px-5 py-[14px] text-[14px]',
        tone === 'app' ? 'font-sans text-[var(--t-text)]' : 'font-sans text-ink',
        colours,
      )}
    >
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className={cn(bare, focusRing, 'cursor-pointer font-semibold')}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}
