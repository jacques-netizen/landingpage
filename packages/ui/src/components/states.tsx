import type { ReactNode } from 'react'
import { cn } from './cn'
import { AlertCircle, Check } from './icons'

/** One sentence and one button, centred. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
      <p className="max-w-sm text-body text-ink-2">{message}</p>
      {action}
    </div>
  )
}

/** Loading placeholder. A flat hairline block, no shimmer when motion is reduced. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('mde-pulse block rounded-chip bg-line', className)} />
}

export function LoadingRows({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line py-3.5">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({
  message = 'Something went wrong on our side. Nothing was lost.',
  action,
}: {
  message?: string
  action?: ReactNode
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-5 px-6 py-16 text-center">
      <AlertCircle size={22} className="text-bad" />
      <p className="max-w-sm text-body text-ink">{message}</p>
      {action}
    </div>
  )
}

/** Inline confirmation after an action completes. */
export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-body text-ink">
      <Check size={16} className="text-ok" />
      {children}
    </p>
  )
}
