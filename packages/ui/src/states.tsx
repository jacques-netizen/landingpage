import type { ReactNode } from 'react'
import { cn, type Tone } from './cn'

type StateProps = { title?: string; body: string; action?: ReactNode; tone?: Tone }

// Empty: one sentence and one button, centred. Paper follows the client report's empty posts row;
// app follows the campaigns and wallet empty states (serif title, muted line, gold button).
export function EmptyState({ title, body, action, tone = 'paper' }: StateProps) {
  if (tone === 'paper') {
    return (
      <div className="border-0 border-t border-solid border-line px-0 py-10 text-center font-sans">
        {title ? <p className="m-0 mb-2 font-serif text-[26px] text-ink">{title}</p> : null}
        <p className="m-0 text-[15px] text-muted-2">{body}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    )
  }
  return (
    <div className="px-2 py-20 text-center font-sans text-[var(--t-text)]">
      {title ? <p className="m-0 font-serif text-[26px]">{title}</p> : null}
      <p className="mt-2 mb-0 text-[13px] text-[var(--t-muted)]">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

// Error: what went wrong in plain words, what is safe, and a retry.
export function ErrorState({ title, body, action, tone = 'paper' }: StateProps & { title: string }) {
  return <EmptyState title={title} body={body} action={action} tone={tone} />
}

// Loading: soft blocks that pulse (the mockups' skeletons). Static when reduced motion is on.
export function Skeleton({ className, tone = 'paper' }: { className?: string; tone?: Tone }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-[pulse_1.4s_ease-in-out_infinite] rounded-[10px]',
        tone === 'paper' ? 'bg-line' : 'bg-[var(--t-soft)]',
        className,
      )}
    />
  )
}

export function LoadingRows({
  rows = 4,
  tone = 'paper',
  label = 'Loading',
}: {
  rows?: number
  tone?: Tone
  label?: string
}) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-[10px]">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} tone={tone} className="h-14" />
      ))}
    </div>
  )
}
