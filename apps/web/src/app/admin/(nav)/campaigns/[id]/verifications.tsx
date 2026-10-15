'use client'

import { Button, ToastProvider, useToast } from '@mde/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ClipPlayer } from '../../_components/clip-player'
import { approveVerificationAction, rejectVerificationAction, type DecisionResult } from './verification-actions'

// The Verifications tab of a campaign (owner brief, 2026-10-15): the creator's insights recording
// next to the clip, scraped against claimed, and Approve at the claimed count, Approve with a different
// number, or Reject with a reason. A approves at the claim, R rejects, J and K move; a decision moves on.

export type VerificationRow = {
  id: string
  status: string
  claimedViews: number | null
  setViews: number | null
  scrapedViews: number | null
  flag: string | null
  note: string | null
  decisionNote: string | null
  submittedAt: string | null
  reviewedAt: string | null
  screenshotUrl: string | null
  recordingUrl: string | null
  clip: {
    id: string
    platform: string
    platformPostId: string
    postUrl: string
    handle: string
    hasVideo: boolean
    hasThumbnail: boolean
  }
  submission: { state: string; latestViews: number; countedViews: number; earnedCents: number; postedAt: string | null }
  creator: { id: string; name: string }
}

const PLATFORM: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' }
const FLAG: Record<string, string> = {
  claim_over_10x: 'Claim is over 10 times the scraped count',
  claim_over_50k: 'Claim is over 50,000 views',
}
const n = (v: number | null) => (v === null ? 'None' : v.toLocaleString('en-US'))
const when = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : '')

type Props = { campaignId: string; items: VerificationRow[]; decided: VerificationRow[] }

function Panel({ campaignId, items: initial, decided: history }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState(initial)
  const [index, setIndex] = useState(0)
  const [other, setOther] = useState('')
  const [note, setNote] = useState('')
  const [, start] = useTransition()
  const done = useRef(new Set<string>())
  useEffect(() => setItems(initial.filter((x) => !done.current.has(x.id))), [initial])
  const current = items[Math.min(index, items.length - 1)] ?? null

  const select = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(i, items.length - 1)))
      setOther('')
      setNote('')
    },
    [items.length],
  )

  const decide = useCallback(
    (id: string, run: () => Promise<DecisionResult>) => {
      done.current.add(id)
      setItems((xs) => xs.filter((x) => x.id !== id))
      setOther('')
      setNote('')
      start(async () => {
        const r = await run()
        if (!r.ok) {
          done.current.delete(id)
          toast(r.error)
        } else toast(r.message)
        router.refresh()
      })
    },
    [router, toast],
  )

  const approveAt = useCallback(
    (views: number | null) => {
      if (!current) return
      if (views === null || !Number.isInteger(views) || views < 0) return toast('Enter the views to approve.')
      const [id, text] = [current.id, note]
      decide(id, () => approveVerificationAction(campaignId, id, views, text))
    },
    [campaignId, current, decide, note, toast],
  )

  const reject = useCallback(() => {
    if (!current) return
    if (!note.trim()) return toast('Write why the verification is rejected. The clipper sees it.')
    const [id, text] = [current.id, note]
    decide(id, () => rejectVerificationAction(campaignId, id, text))
  }, [campaignId, current, decide, note, toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('textarea, input, select, video, iframe, [contenteditable]'))
        return
      const k = e.key.toLowerCase()
      if (k === 'j') select(index + 1)
      else if (k === 'k') select(index - 1)
      else if (k === 'a') approveAt(current?.claimedViews ?? null)
      else if (k === 'r') reject()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [approveAt, current, index, reject, select])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 text-[12px] text-muted">
        <p className="m-0">
          Oldest first. The recording must show the clipper's profile, the post and its insights with the view count.
        </p>
        <p className="m-0">
          <span className="font-semibold text-ink tabular-nums">{items.length} left</span> · A approve at the claim · R
          reject · J next · K previous
        </p>
      </div>

      {current ? (
        <div className="grid grid-cols-[260px_1fr] items-start gap-4 max-lg:grid-cols-1">
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
                    <span className="block truncate text-[13px] font-semibold">{q.clip.handle}</span>
                    <span className="mt-[2px] flex items-center gap-2 text-[12px] text-muted">
                      {q.flag ? <span aria-hidden className="size-[6px] flex-none rounded-full bg-[#E5675C]" /> : null}
                      <span className="truncate">
                        {PLATFORM[q.clip.platform] ?? q.clip.platform} · claims {n(q.claimedViews)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <article aria-label="Verification" className="rounded-[14px] border border-solid border-line bg-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="m-0 font-app text-[20px] font-bold">{current.clip.handle}</h2>
                <p className="mt-1 mb-0 text-[13px] text-muted-2">
                  {current.creator.name} · {PLATFORM[current.clip.platform] ?? current.clip.platform} · sent{' '}
                  {when(current.submittedAt)}
                </p>
              </div>
              <a
                href={`/admin/submissions/${current.clip.id}`}
                className="inline-flex h-8 items-center rounded-pill border border-solid border-sand bg-field px-3 text-[12px] font-medium text-ink no-underline hover:text-ink"
              >
                Post detail
              </a>
            </div>
            {current.flag ? (
              <p
                role="alert"
                className="mt-3 mb-0 rounded-[10px] border border-solid border-[rgba(229,103,92,0.5)] bg-[rgba(229,103,92,0.12)] px-3 py-2 text-[13px] text-[#F08A80]"
              >
                Flagged: {FLAG[current.flag] ?? current.flag}. Check the recording with care.
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-[220px_1fr_220px] gap-4 max-lg:grid-cols-1">
              <div>
                <p className="m-0 mb-2 text-[12px] font-semibold text-muted-2">The clip</p>
                <ClipPlayer key={current.clip.id} clip={current.clip} />
              </div>
              <div>
                <p className="m-0 mb-2 text-[12px] font-semibold text-muted-2">The insights recording</p>
                {current.recordingUrl ? (
                  <video
                    key={current.id}
                    src={current.recordingUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full rounded-[12px] bg-[#0B0A08]"
                    style={{ maxHeight: 520 }}
                  />
                ) : (
                  <p className="m-0 text-[13px] text-muted-2">No recording.</p>
                )}
                {current.screenshotUrl ? (
                  <a href={current.screenshotUrl} target="_blank" rel="noreferrer" className="mt-2 block text-[12px]">
                    Open the screenshot ↗
                  </a>
                ) : null}
                {current.note ? (
                  <p className="mt-2 mb-0 text-[12px] text-muted-2">Clipper's note: {current.note}</p>
                ) : null}
              </div>
              <div>
                <dl className="m-0 grid gap-2">
                  {[
                    ['Scraped views', n(current.scrapedViews)],
                    ['Claimed in insights', n(current.claimedViews)],
                    ['Counted now', n(current.submission.countedViews)],
                    ['Earned now', `$${(current.submission.earnedCents / 100).toFixed(2)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[10px] border border-solid border-line bg-field px-3 py-2">
                      <dt className="text-[11px] text-muted">{k}</dt>
                      <dd className="m-0 mt-[2px] text-[16px] font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-5 border-0 border-t border-solid border-line pt-5 max-md:grid-cols-1">
              <div className="flex flex-col gap-3">
                <Button type="button" onClick={() => approveAt(current.claimedViews)}>
                  Approve at {n(current.claimedViews)}
                </Button>
                <div className="flex gap-2">
                  <input
                    aria-label="Different number of views"
                    inputMode="numeric"
                    placeholder="Different number"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-[10px] border border-solid border-sand bg-field px-3 font-app text-[13px] text-ink"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => approveAt(other.trim() ? Number(other.replace(/[^0-9]/g, '')) : null)}
                  >
                    Approve with this number
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <textarea
                  aria-label="Note to clipper"
                  placeholder="Note to clipper. Required to reject; the clipper sees it."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="box-border h-[72px] w-full resize-y rounded-[10px] border border-solid border-sand bg-field p-3 font-app text-[13px] text-ink"
                />
                <div>
                  <Button type="button" variant="destructive" onClick={reject}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          </article>
        </div>
      ) : (
        <section
          aria-label="Verification"
          className="rounded-[14px] border border-solid border-line bg-panel p-10 text-center text-[14px] text-muted-2"
        >
          No verification is waiting on this campaign.
        </section>
      )}

      {history.length ? (
        <section aria-label="Decided" className="rounded-[14px] border border-solid border-line bg-panel p-5">
          <h2 className="m-0 font-app text-[15px] font-semibold">Decided</h2>
          <ul className="m-0 mt-3 list-none p-0 text-[13px]">
            {history.map((h) => (
              <li key={h.id} className="border-0 border-t border-solid border-line py-2 first:border-t-0">
                <span className="font-semibold">{h.clip.handle}</span>{' '}
                <span className="text-muted-2">
                  {h.status === 'approved' ? `approved at ${n(h.setViews)}` : 'rejected'}
                  {h.claimedViews !== null && h.status === 'approved' && h.setViews !== h.claimedViews
                    ? ` (claimed ${n(h.claimedViews)})`
                    : ''}{' '}
                  · {when(h.reviewedAt)}
                  {h.decisionNote ? ` · ${h.decisionNote}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

export function CampaignVerifications(props: Props) {
  return (
    <ToastProvider>
      <Panel {...props} />
    </ToastProvider>
  )
}
