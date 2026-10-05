'use client'

import { ToastProvider, useToast } from '@mde/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { DesignedFrame } from './frame'
import { ReviewDesign } from './review'
import { reviewContent } from './review.content'
import { makeCopy } from './runtime'

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
  /** Visual tests show the mockup's text in the post box instead of the link. */
  embedLabel?: string
  onApprove?: (id: string, note: string) => Promise<ReviewResult>
  onReject?: (id: string, reasonCode: string, note: string) => Promise<ReviewResult>
}

const PLATFORM: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' }
const DOT = { pass: '#2F7D4F', review: '#B26A00', fail: '#B3261E' } as const
const WORD = { pass: 'Pass', review: 'Review', fail: 'Fail' } as const
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function Screen({ state, items: initial, reasons, embedLabel, onApprove, onReject }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState(initial)
  const [index, setIndex] = useState(0)
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, start] = useTransition()
  useEffect(() => setItems(initial), [initial])
  const current = items[Math.min(index, items.length - 1)] ?? null

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
      // Outside this action, so the next post can be decided while the list refreshes.
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

  // J next, K previous, A approve, R reject (the mockup's shortcuts), never while typing a note.
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

  const nav = (href: string) => () => router.push(href)
  const v = {
    goHome: nav('/admin'),
    nav: {
      dashboard: nav('/admin'),
      campaigns: nav('/admin/campaigns'),
      review: nav('/admin/review'),
      creators: nav('/admin/creators'),
      appeals: nav('/admin/appeals'),
      ledger: nav('/admin/ledger'),
      payouts: nav('/admin/payouts'),
      settings: nav('/admin/settings'),
      audit: nav('/admin/audit-log'),
    },
    subtitle:
      state === 'loading'
        ? 'Loading'
        : state === 'error'
          ? 'Could not load the queue. Reload the page to try again.'
          : items.length
            ? 'Oldest first'
            : 'Nothing waiting for review.',
    queue: items.map((q, i) => ({
      who: q.who,
      meta: `${PLATFORM[q.platform] ?? q.platform} · ${q.campaignTitle}${q.flagged ? ' · flagged' : ''}`,
      bg: q.id === current?.id ? '#fff' : 'transparent',
      go: () => select(i),
    })),
    current: state === 'data' ? current : null,
    meta: current ? `${PLATFORM[current.platform] ?? current.platform} · ${current.campaignTitle} campaign · Submitted ${day(current.submittedAt)}` : '',
    embedLabel: embedLabel ?? (current ? current.postUrl.replace(/^https?:\/\/(www\.)?/, '') : ''),
    openPost: () => current && window.open(current.postUrl, '_blank', 'noopener'),
    openDetail: () => current && router.push(`/admin/submissions/${current.id}`),
    checks: (current?.checks ?? []).map((c) => ({ t: c.label, s: WORD[c.status], dot: DOT[c.status] })),
    reasons: reasons.map((r) => ({ label: r.label, on: r.code === reason, go: () => setReason((x) => (x === r.code ? null : r.code)) })),
    note,
    onNote: (e: { target: { value: string } }) => setNote(e.target.value),
    approve,
    reject,
  }
  return <ReviewDesign v={v} copy={makeCopy(reviewContent, {})} />
}

// The staff review queue and post detail ("Creator Site v1", screen review).
export function ReviewView(props: Props) {
  return (
    <DesignedFrame>
      <ToastProvider>
        <Screen {...props} />
      </ToastProvider>
    </DesignedFrame>
  )
}
