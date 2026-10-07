'use client'

import { Button, ToastProvider, useToast } from '@mde/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

export type ReviewCheck = { label: string; status: 'pass' | 'fail' | 'review' }
export type ReviewItem = {
  id: string
  who: string
  platform: string
  campaignTitle: string
  flagged: boolean
  submittedAt: string
  postUrl: string
  checks: ReviewCheck[]
}
export type ReviewReason = { code: string; label: string }
export type ReviewResult = { ok: true } | { ok: false; error: string }

type Props = {
  state: 'data' | 'loading' | 'error'
  items: ReviewItem[]
  reasons: ReviewReason[]
  onApprove?: (id: string, note: string) => Promise<ReviewResult>
  onReject?: (id: string, reasonCode: string, note: string) => Promise<ReviewResult>
}

const PLATFORM: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' }
const DOT = { pass: '#4FB286', review: '#E0A94A', fail: '#E5675C' } as const
const WORD = { pass: 'Pass', review: 'Review', fail: 'Fail' } as const
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const panel = 'rounded-[14px] border border-solid border-line bg-panel'

function Console({ state, items: initial, reasons, onApprove, onReject }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState(initial)
  const [index, setIndex] = useState(0)
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, start] = useTransition()
  useEffect(() => setItems(initial), [initial])
  const current = state === 'data' ? (items[Math.min(index, items.length - 1)] ?? null) : null

  const select = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(i, items.length - 1)))
      setReason(null)
      setNote('')
    },
    [items.length],
  )

  const finish = useCallback(
    (id: string, r: ReviewResult, done: string) => {
      if (!r.ok) return toast(r.error)
      toast(done)
      // Move on to the next post; the list refreshes from the server behind it.
      setItems((xs) => xs.filter((x) => x.id !== id))
      setReason(null)
      setNote('')
      setTimeout(() => router.refresh(), 0)
    },
    [router, toast],
  )

  const approve = useCallback(() => {
    if (!current || busy || !onApprove) return
    const id = current.id
    start(async () => finish(id, await onApprove(id, note), 'Approved.'))
  }, [busy, current, finish, note, onApprove])

  const reject = useCallback(() => {
    if (!current || busy || !onReject) return
    if (!reason) return toast('Choose a reason, then reject.')
    const id = current.id
    start(async () => finish(id, await onReject(id, reason, note), 'Rejected.'))
  }, [busy, current, finish, note, onReject, reason, toast])

  // J next, K previous, A approve, R reject, never while typing a note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('textarea, input, select, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'j') select(index + 1)
      else if (k === 'k') select(index - 1)
      else if (k === 'a') approve()
      else if (k === 'r') reject()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [approve, index, reject, select])

  const subtitle =
    state === 'loading'
      ? 'Loading'
      : state === 'error'
        ? 'Could not load the queue. Reload the page to try again.'
        : items.length
          ? 'Oldest first'
          : 'Nothing waiting for review.'

  return (
    <div className="mx-auto max-w-[1200px] px-10 py-8 max-md:px-4">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="m-0 font-app text-[24px] font-bold tracking-[-0.01em]">Review queue</h1>
          <p className="mt-1 mb-0 text-[13px] text-muted-2" role={state === 'error' ? 'alert' : undefined}>
            {subtitle}
          </p>
        </div>
        <p className="m-0 text-[12px] text-muted">J next · K previous · A approve · R reject</p>
      </div>

      <div className="mt-6 grid grid-cols-[320px_1fr] items-start gap-4 max-lg:grid-cols-1">
        <section aria-label="Queue" className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-0 border-b border-solid border-line px-4 py-3 text-[12px] text-muted">
            <span>Waiting</span>
            <span className="tabular-nums">{state === 'data' ? items.length : ''}</span>
          </div>
          {state === 'loading' ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[52px] animate-pulse rounded-[10px] bg-field-2" />
              ))}
            </div>
          ) : (
            <ul className="m-0 max-h-[70vh] list-none overflow-y-auto p-2">
              {items.map((q, i) => {
                const on = q.id === current?.id
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => select(i)}
                      aria-current={on ? 'true' : undefined}
                      className={`block w-full cursor-pointer rounded-[10px] border-0 px-3 py-[10px] text-left font-app ${
                        on ? 'bg-field-2' : 'bg-transparent hover:bg-field'
                      } text-ink`}
                    >
                      <span className="block truncate text-[14px] font-semibold">{q.who}</span>
                      <span className="mt-[2px] flex items-center gap-2 text-[12px] text-muted">
                        {q.flagged ? (
                          <span aria-hidden className="size-[6px] flex-none rounded-full bg-[#E5675C]" />
                        ) : null}
                        <span className="truncate">
                          {PLATFORM[q.platform] ?? q.platform} · {q.campaignTitle}
                          {q.flagged ? ' · flagged' : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {current ? (
          <section aria-label="Post" className={`${panel} p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="m-0 font-app text-[20px] font-bold">{current.who}</h2>
                <p className="mt-1 mb-0 text-[13px] text-muted-2">
                  {PLATFORM[current.platform] ?? current.platform} · {current.campaignTitle} campaign · Submitted{' '}
                  {day(current.submittedAt)}
                </p>
              </div>
              <a
                href={`/admin/submissions/${current.id}`}
                className="inline-flex h-9 items-center rounded-pill border border-solid border-sand bg-field px-4 text-[13px] font-medium text-ink no-underline hover:text-ink"
              >
                Post detail
              </a>
            </div>

            <a
              href={current.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex h-[120px] items-center justify-center rounded-[12px] border border-dashed border-sand bg-field px-4 text-center text-[14px] break-all"
            >
              {current.postUrl.replace(/^https?:\/\/(www\.)?/, '')} ↗
            </a>

            <h3 className="mt-6 mb-2 text-[13px] font-semibold">Checks</h3>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 max-md:grid-cols-1">
              {current.checks.map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-solid border-line bg-field px-4 py-[10px] text-[13px]"
                >
                  <span>{c.label}</span>
                  <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap">
                    <span aria-hidden className="size-[7px] rounded-full" style={{ background: DOT[c.status] }} />
                    {WORD[c.status]}
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="mt-6 mb-2 text-[13px] font-semibold">Reason, if rejecting</h3>
            <div className="flex flex-wrap gap-2">
              {reasons.map((r) => {
                const on = r.code === reason
                return (
                  <button
                    key={r.code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setReason((x) => (x === r.code ? null : r.code))}
                    className={`h-9 cursor-pointer rounded-pill border border-solid px-4 font-app text-[13px] ${
                      on ? 'border-gold-soft bg-gold-soft text-[#1A1510]' : 'border-sand bg-transparent text-ink'
                    }`}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>

            <textarea
              aria-label="Note to creator"
              placeholder="Note to creator"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-4 box-border h-[80px] w-full resize-y rounded-[10px] border border-solid border-sand bg-field p-3 font-app text-[14px] text-ink"
            />

            <div className="mt-4 flex gap-3">
              <Button type="button" onClick={approve} loading={busy} disabled={busy}>
                Approve
              </Button>
              <Button type="button" variant="secondary" onClick={reject} disabled={busy}>
                Reject
              </Button>
            </div>
          </section>
        ) : (
          <section aria-label="Post" className={`${panel} p-10 text-center text-[14px] text-muted-2`}>
            {state === 'data' ? 'All caught up. New posts appear here as creators submit them.' : null}
          </section>
        )}
      </div>
    </div>
  )
}

// The staff review queue in the dark staff console (owner request, 2026-10-07).
export function ReviewConsole(props: Props) {
  return (
    <ToastProvider>
      <Console {...props} />
    </ToastProvider>
  )
}
