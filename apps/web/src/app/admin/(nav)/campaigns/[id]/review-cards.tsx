'use client'

import { Button, ToastProvider, useToast } from '@mde/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ClipPlayer, UnavailableBadge } from '../../_components/clip-player'
import type { ReviewCard } from '@/server/campaign-workspace'
import { approvePostAction, denyPostAction, type RowResult } from './submission-actions'

// The Review tab of a campaign (owner brief, 2026-10-15): one card per post with the clip playing
// inline, who posted it, its scraped figures and the automatic checks, and Approve or Reject with a
// reason. The campaign's rules sit once at the top. A decision moves to the next post; A approves, R
// rejects, J and K move. "12 left" counts down.

export type ReviewReason = { code: string; label: string }
/** The quick reasons on every card, in the owner's order. The rest sit under "More reasons". */
const QUICK = ['wrong_audio', 'wrong_content', 'low_quality', 'duplicate_post', 'account_not_eligible', 'other']
const PLATFORM: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' }
const DOT = { pass: '#4FB286', review: '#E0A94A', fail: '#E5675C' } as const
const WORD = { pass: 'Pass', review: 'Review', fail: 'Fail' } as const
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Unknown'
const n = (v: number | null) => (v === null ? 'No check yet' : v.toLocaleString('en-US'))

type Props = {
  campaignId: string
  items: ReviewCard[]
  reasons: ReviewReason[]
  rules: [string, string][]
}

function Cards({ campaignId, items: initial, reasons, rules }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState(initial)
  const [index, setIndex] = useState(0)
  const [reason, setReason] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [note, setNote] = useState('')
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  const [, start] = useTransition()
  // Posts decided here stay out of the list even if a refresh that started before the decision brings
  // them back, so a quick key press never lands on a post that is already decided.
  const decided = useRef(new Set<string>())
  useEffect(() => setItems(initial.filter((x) => !decided.current.has(x.id))), [initial])
  const current = items[Math.min(index, items.length - 1)] ?? null

  const select = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(i, items.length - 1)))
      setReason(null)
      setNote('')
      setMore(false)
    },
    [items.length],
  )

  const decide = useCallback(
    (id: string, run: () => Promise<RowResult>, done: string) => {
      decided.current.add(id)
      setItems((xs) => xs.filter((x) => x.id !== id))
      setReason(null)
      setNote('')
      setMore(false)
      start(async () => {
        const r = await run()
        if (!r.ok) {
          decided.current.delete(id)
          toast(r.error)
        } else toast(done)
        router.refresh()
      })
    },
    [router, toast],
  )

  const approve = useCallback(() => {
    if (!current) return
    const [id, text] = [current.id, note]
    decide(id, () => approvePostAction(campaignId, id, text), 'Approved.')
  }, [campaignId, current, decide, note])

  const reject = useCallback(() => {
    if (!current) return
    if (!reason) return toast('Choose a reason, then reject.')
    if (reason === 'other' && !note.trim()) return toast('Write what is wrong when the reason is Other.')
    const [id, code, text] = [current.id, reason, note]
    decide(id, () => denyPostAction(campaignId, id, code, text), 'Rejected.')
  }, [campaignId, current, decide, note, reason, toast])

  // J next, K previous, A approve, R reject, never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('textarea, input, select, video, iframe, [contenteditable]'))
        return
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

  const quick = QUICK.map((code) => reasons.find((r) => r.code === code)).filter((r): r is ReviewReason => !!r)
  const rest = reasons.filter((r) => !QUICK.includes(r.code))
  const chip = (r: ReviewReason) => {
    const on = r.code === reason
    return (
      <button
        key={r.code}
        type="button"
        aria-pressed={on}
        onClick={() => setReason((x) => (x === r.code ? null : r.code))}
        className={`h-8 cursor-pointer rounded-pill border border-solid px-3 font-app text-[12px] ${
          on ? 'border-gold-soft bg-gold-soft text-[#1A1510]' : 'border-sand bg-transparent text-ink'
        }`}
      >
        {r.label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Campaign rules"
        className="rounded-[14px] border border-solid border-line bg-panel px-5 py-4 text-[13px]"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 font-app text-[15px] font-semibold">Campaign rules</h2>
          <p className="m-0 text-[12px] text-muted">
            <span className="font-semibold text-ink tabular-nums">{items.length} left</span> · A approve · R reject · J
            next · K previous
          </p>
        </div>
        <dl className="m-0 mt-3 grid grid-cols-4 gap-x-6 gap-y-2 max-lg:grid-cols-2">
          {rules.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] text-muted">{k}</dt>
              <dd className="m-0 truncate font-medium" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {current ? (
        <div className="grid grid-cols-[280px_1fr] items-start gap-4 max-lg:grid-cols-1">
          <aside aria-label="Waiting" className="rounded-[14px] border border-solid border-line bg-panel">
            <ul className="m-0 max-h-[70vh] list-none overflow-y-auto p-2">
              {items.map((q, i) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-current={q.id === current.id ? 'true' : undefined}
                    className={`block w-full cursor-pointer rounded-[10px] border-0 px-3 py-[9px] text-left font-app ${
                      q.id === current.id ? 'bg-field-2' : 'bg-transparent hover:bg-field'
                    } text-ink`}
                  >
                    <span className="block truncate text-[13px] font-semibold">{q.handle}</span>
                    <span className="mt-[2px] flex items-center gap-2 text-[12px] text-muted">
                      {q.flagged ? (
                        <span aria-hidden className="size-[6px] flex-none rounded-full bg-[#E5675C]" />
                      ) : null}
                      <span className="truncate">
                        {PLATFORM[q.platform] ?? q.platform} · submitted {day(q.submittedAt)}
                        {q.flagged ? ' · flagged' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <article aria-label="Post" className="rounded-[14px] border border-solid border-line bg-panel p-5">
            <div className="grid grid-cols-[260px_1fr] gap-5 max-md:grid-cols-1">
              <div>
                <ClipPlayer
                  key={current.id}
                  clip={current}
                  open
                  onUnavailable={(id) => setUnavailable((s) => new Set(s).add(id))}
                />
                <a
                  href={current.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block truncate text-[12px] text-muted-2"
                >
                  {current.postUrl.replace(/^https?:\/\/(www\.)?/, '')} ↗
                </a>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="m-0 flex items-center gap-2 font-app text-[20px] font-bold">
                      {current.handle}
                      {unavailable.has(current.id) ? <UnavailableBadge /> : null}
                    </h2>
                    <p className="mt-1 mb-0 text-[13px] text-muted-2">
                      {current.who} · {PLATFORM[current.platform] ?? current.platform} · Posted {day(current.postedAt)}{' '}
                      · Submitted {day(current.submittedAt)}
                      {current.flagged ? ' · Flagged' : ''}
                    </p>
                  </div>
                  <a
                    href={`/admin/submissions/${current.id}`}
                    className="inline-flex h-8 items-center rounded-pill border border-solid border-sand bg-field px-3 text-[12px] font-medium text-ink no-underline hover:text-ink"
                  >
                    Post detail
                  </a>
                </div>

                <dl className="m-0 mt-4 grid grid-cols-3 gap-3">
                  {[
                    ['Scraped views', n(current.views)],
                    ['Likes', n(current.likes)],
                    ['Comments', n(current.comments)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[10px] border border-solid border-line bg-field px-3 py-2">
                      <dt className="text-[11px] text-muted">{k}</dt>
                      <dd className="m-0 mt-[2px] text-[16px] font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>

                <h3 className="mt-4 mb-2 text-[13px] font-semibold">Checks</h3>
                <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 max-md:grid-cols-1">
                  {current.checks.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-[10px] border border-solid border-line bg-field px-3 py-2 text-[12px]"
                    >
                      <span>{c.label}</span>
                      <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap">
                        <span aria-hidden className="size-[7px] rounded-full" style={{ background: DOT[c.status] }} />
                        {WORD[c.status]}
                      </span>
                    </li>
                  ))}
                </ul>

                <h3 className="mt-4 mb-2 text-[13px] font-semibold">Reason, if rejecting</h3>
                <div className="flex flex-wrap gap-2">
                  {quick.map(chip)}
                  {rest.length ? (
                    <button
                      type="button"
                      onClick={() => setMore((m) => !m)}
                      className="h-8 cursor-pointer rounded-pill border border-dashed border-sand bg-transparent px-3 font-app text-[12px] text-muted-2"
                    >
                      {more ? 'Fewer reasons' : 'More reasons'}
                    </button>
                  ) : null}
                </div>
                {more ? <div className="mt-2 flex flex-wrap gap-2">{rest.map(chip)}</div> : null}
                <textarea
                  aria-label="Note to clipper"
                  placeholder={
                    reason === 'other' ? 'What is wrong (the clipper sees this)' : 'Note to clipper (optional)'
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-3 box-border h-[64px] w-full resize-y rounded-[10px] border border-solid border-sand bg-field p-3 font-app text-[13px] text-ink"
                />
                <div className="mt-3 flex gap-3">
                  <Button type="button" onClick={approve}>
                    Approve
                  </Button>
                  <Button type="button" variant="secondary" onClick={reject}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          </article>
        </div>
      ) : (
        <section
          aria-label="Post"
          className="rounded-[14px] border border-solid border-line bg-panel p-10 text-center text-[14px] text-muted-2"
        >
          All caught up. New posts appear here as clippers submit them.
        </section>
      )}
    </div>
  )
}

export function CampaignReview(props: Props) {
  return (
    <ToastProvider>
      <Cards {...props} />
    </ToastProvider>
  )
}
