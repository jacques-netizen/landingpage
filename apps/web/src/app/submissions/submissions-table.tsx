'use client'

import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { formatDollars } from '@mde/money/dollars'
import { Button, Drawer, DrawerSection, Field, Input, LineChart, LoadingRows, Textarea } from '@mde/ui'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { STATUS_COLOURS } from '@/components/app-ui'
import { LocalDateTime } from '@/components/local-time'
import {
  answerInfoAction,
  appealAction,
  requestViewProofAction,
  submissionDetailAction,
  submitViewProofAction,
  type AppealFormState,
  type ProofFormState,
  type SubmissionDetail,
} from './actions'

type Row = {
  id: string
  campaignTitle: string
  platform: string
  postUrl: string
  stateLabel: string
  stateTone: keyof typeof STATUS_COLOURS
  reason: string | null
  latestViews: number
  countedViews: number
  earnedCents: number
  submittedAt: string
  /** "Verify views" on an approved post (owner brief, 2026-10-15): open now, or waiting on staff. */
  verify: { why: string | null; open: boolean; pending: boolean } | null
}

const count = (n: number) => n.toLocaleString('en-US')
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const CHECK_DOT = { pass: '#2F7D4F', review: '#B26A00', fail: '#E5675C' } as const
const CHECK_WORD = { pass: 'Pass', review: 'Review', fail: 'Fail' } as const

function Dot({ tone, children }: { tone: keyof typeof STATUS_COLOURS; children: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold whitespace-nowrap">
      <span aria-hidden className="size-[7px] rounded-full" style={{ background: STATUS_COLOURS[tone] }} />
      {children}
    </span>
  )
}

const th = 'px-3 py-3 text-left text-[12px] font-semibold text-[var(--t-muted)] whitespace-nowrap'
const td = 'border-0 border-t border-solid border-[var(--t-hair)] px-3 py-[14px] align-top text-[13px]'

export function SubmissionsTable({
  rows,
  theme,
  openId,
}: {
  rows: Row[]
  theme: 'dark' | 'glass'
  /** A notification links to one submission; its drawer opens on arrival. */
  openId?: string
}) {
  const [open, setOpen] = useState<Row | null>(null)
  const [detail, setDetail] = useState<SubmissionDetail | null | 'error'>(null)
  const [loading, start] = useTransition()

  const load = (row: Row) => {
    setOpen(row)
    setDetail(null)
    start(async () => {
      try {
        setDetail((await submissionDetailAction(row.id)) ?? 'error')
      } catch {
        setDetail('error')
      }
    })
  }

  useEffect(() => {
    const row = openId ? rows.find((r) => r.id === openId) : undefined
    if (row) load(row)
    // Only on arrival.
  }, [])

  return (
    <>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse font-app text-[var(--t-text)]">
          <caption className="sr-only">Your submissions. Choose a row to see its details.</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Campaign
              </th>
              <th scope="col" className={th}>
                State
              </th>
              <th scope="col" className={`${th} text-right`}>
                Views
              </th>
              <th scope="col" className={`${th} text-right`}>
                Counted
              </th>
              <th scope="col" className={`${th} text-right`}>
                Earnings
              </th>
              <th scope="col" className={th}>
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-[var(--t-soft)]" onClick={() => load(r)}>
                <td className={td}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      load(r)
                    }}
                    className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left font-app text-[14px] font-semibold text-[var(--t-text)]"
                  >
                    {r.campaignTitle}
                  </button>
                  <div className="mt-1 text-[12px] text-[var(--t-muted)]">
                    {PLATFORM_LABELS[r.platform as keyof typeof PLATFORM_LABELS] ?? r.platform} ·{' '}
                    <a
                      href={r.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--t-muted)] hover:text-[var(--t-accent-ink)]"
                    >
                      Open post
                    </a>
                  </div>
                </td>
                <td className={td}>
                  <Dot tone={r.stateTone}>{r.stateLabel}</Dot>
                  {r.reason ? (
                    <div className="mt-1 max-w-[260px] text-[12px] leading-[1.4] text-[var(--t-muted)]">{r.reason}</div>
                  ) : null}
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {count(r.latestViews)}
                  {r.verify?.open ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Opens the verification and the drawer with its form in one step.
                        start(async () => {
                          await requestViewProofAction(r.id)
                          load(r)
                        })
                      }}
                      className={`mt-1 block w-full cursor-pointer rounded-[8px] border border-solid px-2 py-[3px] font-app text-[11px] font-semibold ${
                        r.verify.why === 'instagram_post'
                          ? 'border-gold-soft bg-gold-soft text-ink'
                          : 'border-[var(--t-hair)] bg-transparent text-[var(--t-text)]'
                      }`}
                    >
                      Verify views
                    </button>
                  ) : r.verify?.pending ? (
                    <span className="mt-1 block text-[11px] text-[var(--t-muted)]">Verification pending</span>
                  ) : null}
                </td>
                <td className={`${td} text-right tabular-nums`}>{count(r.countedViews)}</td>
                <td className={`${td} text-right font-semibold tabular-nums`}>{formatDollars(r.earnedCents)}</td>
                <td className={`${td} whitespace-nowrap text-[var(--t-muted)]`}>{shortDate(r.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        theme={theme}
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.campaignTitle ?? ''}
        description={open ? `${open.stateLabel}. Submitted ${shortDate(open.submittedAt)}.` : undefined}
      >
        {loading || detail === null ? (
          <div className="py-6">
            <LoadingRows tone="app" rows={4} label="Loading the submission" />
          </div>
        ) : detail === 'error' ? (
          <div className="py-6">
            <p className="m-0 mb-4 text-[14px]">Could not load this submission.</p>
            <Button tone="app" size="sm" onClick={() => open && load(open)}>
              Try again
            </Button>
          </div>
        ) : (
          <Detail d={detail} onAppealed={() => open && load(open)} />
        )}
      </Drawer>
    </>
  )
}

function Detail({ d, onAppealed }: { d: SubmissionDetail; onAppealed: () => void }) {
  return (
    <>
      <DrawerSection app title="Views">
        <dl className="m-0 mb-4 grid grid-cols-3 gap-3 text-[13px]">
          {[
            ['Total views', count(d.latestViews)],
            ['Counted views', count(d.countedViews)],
            ['Earnings', formatDollars(d.earnedCents)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[var(--t-muted)]">{k}</dt>
              <dd className="m-0 mt-1 text-[18px] font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {d.views.length ? (
          <LineChart
            tone="app"
            title="Views over time"
            summary={`Views went from ${count(d.views[0]!.views)} to ${count(d.views.at(-1)!.views)} over ${d.views.length} checks.`}
            points={d.views.map((v) => ({
              label: new Date(v.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
              value: v.views,
            }))}
          />
        ) : (
          <p className="m-0 text-[13px] text-[var(--t-muted)]">No view checks yet.</p>
        )}
        <p className="mt-3 mb-0 text-[12px] text-[var(--t-muted)]">
          Last updated {d.lastCheckedAt ? <LocalDateTime iso={d.lastCheckedAt} /> : 'not yet'}. The views at submission
          are the starting point and are not counted.
        </p>
        <ProofPanel d={d} onChanged={onAppealed} />
      </DrawerSection>

      {d.state === 'needs_info' ? (
        <DrawerSection app title="A reviewer asked">
          {d.reasonNote ? <p className="m-0 mb-4 text-[14px]">{d.reasonNote}</p> : null}
          <AnswerForm id={d.id} onDone={onAppealed} />
        </DrawerSection>
      ) : null}

      {d.state !== 'needs_info' && (d.reason || d.reasonNote) ? (
        <DrawerSection app title="Reason">
          {d.reason ? <p className="m-0 text-[14px] font-semibold">{d.reason}</p> : null}
          {d.reasonNote ? <p className="mt-2 mb-0 text-[14px] text-[var(--t-muted)]">{d.reasonNote}</p> : null}
        </DrawerSection>
      ) : null}

      {d.checks.length ? (
        <DrawerSection app title="Automatic checks">
          <ul className="m-0 list-none p-0">
            {d.checks.map((c) => (
              <li
                key={c.check}
                className="border-0 border-b border-solid border-[var(--t-hair)] py-[10px] text-[13px] last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{c.label}</span>
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span aria-hidden className="size-[7px] rounded-full" style={{ background: CHECK_DOT[c.status] }} />
                    {CHECK_WORD[c.status]}
                  </span>
                </div>
                {c.message ? <p className="mt-1 mb-0 text-[var(--t-muted)]">{c.message}</p> : null}
              </li>
            ))}
          </ul>
        </DrawerSection>
      ) : null}

      <DrawerSection app title="History">
        <ol className="m-0 list-none p-0">
          {d.history.map((h, i) => (
            <li key={i} className="py-2 text-[13px]">
              <span className="font-semibold">{h.text}</span>{' '}
              <span className="text-[var(--t-muted)]">
                <LocalDateTime iso={h.at} />
              </span>
              {h.note ? <p className="mt-1 mb-0 text-[var(--t-muted)]">{h.note}</p> : null}
            </li>
          ))}
        </ol>
      </DrawerSection>

      {d.appeal ? (
        <DrawerSection app title="Appeal">
          <p className="m-0 text-[14px] font-semibold">{APPEAL_STATUS[d.appeal.status] ?? d.appeal.status}</p>
          {d.appeal.status === 'open' ? (
            <p className="mt-1 mb-0 text-[13px] text-[var(--t-muted)]">
              A reviewer replies by <LocalDateTime iso={d.appeal.dueAt} />.
            </p>
          ) : null}
          {d.appeal.reply ? <p className="mt-2 mb-0 text-[14px]">{d.appeal.reply}</p> : null}
        </DrawerSection>
      ) : d.canAppeal ? (
        <DrawerSection app title="Appeal">
          <AppealForm id={d.id} onDone={onAppealed} />
        </DrawerSection>
      ) : null}

      {d.creatorNote ? (
        <DrawerSection app title="Your note">
          <p className="m-0 text-[14px]">{d.creatorNote}</p>
        </DrawerSection>
      ) : null}

      <div className="flex gap-4 py-6 text-[13px] font-semibold">
        <a href={d.postUrl} target="_blank" rel="noreferrer" className="text-[var(--t-accent-ink)]">
          Open post
        </a>
        <a href={`/campaigns/${d.campaignId}`} className="text-[var(--t-accent-ink)]">
          Open campaign
        </a>
      </div>
    </>
  )
}

const APPEAL_STATUS: Record<string, string> = {
  open: 'Appeal sent, waiting for a reply.',
  overturned: 'Appeal accepted. The post is back in the campaign.',
  upheld: 'Appeal answered. The decision stays.',
}

function AppealForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<AppealFormState, FormData>(async (prev, form) => {
    const next = await appealAction(id, prev, form)
    if (next.ok) onDone()
    return next
  }, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="m-0 text-[13px] text-[var(--t-muted)]">
        Think the decision is wrong? Tell a reviewer why. You can appeal once.
      </p>
      <Field label="Why should the decision change?" tone="app" helper="Up to 1,000 characters.">
        {(p) => (
          <Textarea
            tone="app"
            id={p.id}
            aria-describedby={p.describedBy}
            name="message"
            rows={4}
            maxLength={1000}
            required
          />
        )}
      </Field>
      <Field label="Links" tone="app" helper="Optional. Screenshots or posts that back you up, one per line.">
        {(p) => <Textarea tone="app" id={p.id} aria-describedby={p.describedBy} name="links" rows={2} />}
      </Field>
      {state.error && !pending ? (
        <p role="alert" className="m-0 text-[14px] text-flagged">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" tone="app" loading={pending}>
        Send appeal
      </Button>
    </form>
  )
}

function AnswerForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<AppealFormState, FormData>(async (prev, form) => {
    const next = await answerInfoAction(id, prev, form)
    if (next.ok) onDone()
    return next
  }, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your answer" tone="app" helper="Up to 1,000 characters. Your post goes back to the reviewer.">
        {(p) => (
          <Textarea
            tone="app"
            id={p.id}
            aria-describedby={p.describedBy}
            name="answer"
            rows={3}
            maxLength={1000}
            required
          />
        )}
      </Field>
      {state.error && !pending ? (
        <p role="alert" className="m-0 text-[14px] text-flagged">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" tone="app" loading={pending}>
        Send answer
      </Button>
    </form>
  )
}

const PROOF_STATUS: Record<string, string> = {
  submitted: 'Verification pending',
  approved: 'Your verification was approved.',
  rejected: 'Your verification was not accepted.',
}

const WHY: Record<string, string> = {
  picture: 'Picture posts do not show views publicly. Upload your insights to get your views counted.',
  no_views: 'The automatic check has not read any views on this post yet. Upload your insights to get them counted.',
  stale: 'The view count has not moved for two days. Upload your insights if it is higher.',
}

/**
 * Verify views (owner brief, 2026-10-15): a screen recording of the post's insights with the count it
 * shows, for Instagram posts always and for other approved posts when the automatic check reads nothing.
 */
function ProofPanel({ d, onChanged }: { d: SubmissionDetail; onChanged: () => void }) {
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const p = d.proof
  const v = d.verify
  const open = p?.status === 'requested'
  if (!p && !v.why) return null
  const why = v.why === 'instagram_post' ? d.verifyText.instagram : v.why ? WHY[v.why] : null
  return (
    <div className="mt-4 border-0 border-t border-solid border-[var(--t-hair)] pt-4">
      <p className="m-0 text-[13px] font-semibold">Verify views</p>
      {why ? <p className="mt-1 mb-0 text-[12px] text-[var(--t-muted)]">{why}</p> : null}
      {p && p.status !== 'requested' ? (
        <div className="mt-3 rounded-[12px] bg-[var(--t-glass)] p-3 text-[13px]">
          <p className="m-0 font-semibold">{PROOF_STATUS[p.status]}</p>
          {p.status === 'approved' && p.setViews !== null ? (
            <p className="mt-1 mb-0 text-[var(--t-muted)]">
              {count(p.setViews)} views verified
              {p.reviewedAt ? (
                <>
                  {' '}
                  on <LocalDateTime iso={p.reviewedAt} />
                </>
              ) : null}
              .
            </p>
          ) : null}
          {p.status === 'submitted' && p.claimedViews !== null ? (
            <p className="mt-1 mb-0 text-[var(--t-muted)]">
              You reported {count(p.claimedViews)} views. We check the recording and update the count.
            </p>
          ) : null}
          {p.decisionNote ? <p className="mt-1 mb-0 text-[var(--t-muted)]">{p.decisionNote}</p> : null}
        </div>
      ) : null}
      {v.blocked ? (
        <p className="mt-2 mb-0 text-[12px] text-flagged">
          Three of your verifications in this campaign were rejected, so you cannot send more here.
        </p>
      ) : v.nextAt ? (
        <p className="mt-2 mb-0 text-[12px] text-[var(--t-muted)]">
          You can send the next verification after <LocalDateTime iso={v.nextAt} />.
        </p>
      ) : null}
      {open && p ? (
        <ProofForm d={d} proofId={p.id} onDone={onChanged} />
      ) : v.can ? (
        <div className="mt-3">
          <Button
            type="button"
            tone="app"
            variant={v.why === 'instagram_post' ? 'primary' : 'secondary'}
            size="sm"
            loading={busy}
            onClick={() =>
              start(async () => {
                setError(null)
                const r = await requestViewProofAction(d.id)
                if (r.error) setError(r.error)
                else onChanged()
              })
            }
          >
            Verify views
          </Button>
          {error ? (
            <p role="alert" className="mt-2 mb-0 text-[13px] text-flagged">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const MAX_SECONDS = 60
const MAX_BYTES = 100 * 1024 * 1024

/** How long a video file runs, read in the browser before it is uploaded. */
function duration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(v.duration) ? v.duration : null)
    }
    v.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    v.src = url
  })
}

function ProofForm({ d, proofId, onDone }: { d: SubmissionDetail; proofId: string; onDone: () => void }) {
  const [files, setFiles] = useState<{ screenshot?: string; recording?: string }>({})
  const [uploading, setUploading] = useState<{ screenshot?: boolean; recording?: boolean }>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [state, action, pending] = useActionState<ProofFormState, FormData>(async (prev, form) => {
    const next = await submitViewProofAction(proofId, prev, form)
    if (next.ok) onDone()
    return next
  }, {})
  const upload = async (kind: 'screenshot' | 'recording', file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    if (kind === 'recording') {
      if (file.size > MAX_BYTES) return setUploadError('The recording is over 100 MB. Trim it and try again.')
      const secs = await duration(file)
      if (secs !== null && secs > MAX_SECONDS + 0.5)
        return setUploadError(`The recording runs ${Math.round(secs)} seconds. Keep it to ${MAX_SECONDS} seconds.`)
    }
    setUploading((u) => ({ ...u, [kind]: true }))
    try {
      const res = await fetch(`/api/view-proofs/${proofId}/file?kind=${kind}`, {
        method: 'POST',
        body: file,
        headers: { 'content-type': file.type || 'application/octet-stream' },
      })
      const j = (await res.json()) as { fileId?: string; error?: { message: string } }
      if (!res.ok || !j.fileId) throw new Error(j.error?.message ?? 'The upload failed. Try again.')
      setFiles((f) => ({ ...f, [kind]: j.fileId }))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'The upload failed. Try again.')
    } finally {
      setUploading((u) => ({ ...u, [kind]: false }))
    }
  }
  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <div className="rounded-[12px] bg-[var(--t-glass)] p-3">
        <p className="m-0 text-[13px] font-semibold">{d.verifyText.instruction}</p>
        <ol className="mt-2 mb-0 pl-5 text-[12px] text-[var(--t-muted)]">
          {d.proofRules.slice(1).map((r) => (
            <li key={r} className="py-[2px]">
              {r}
            </li>
          ))}
        </ol>
      </div>
      <Field label="Screen recording" tone="app" helper={d.verifyText.limits}>
        {(p) => (
          <input
            id={p.id}
            aria-describedby={p.describedBy}
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            className="block w-full text-[13px]"
            onChange={(e) => upload('recording', e.target.files?.[0])}
          />
        )}
      </Field>
      <input type="hidden" name="recordingFileId" value={files.recording ?? ''} />
      <input type="hidden" name="screenshotFileId" value={files.screenshot ?? ''} />
      <Field label="Views shown in your insights" tone="app">
        {(p) => <Input tone="app" id={p.id} name="views" inputMode="numeric" required placeholder="12,345" />}
      </Field>
      <Field label="Screenshot of the insights" tone="app" helper="Optional. PNG, JPG or WebP.">
        {(p) => (
          <input
            id={p.id}
            aria-describedby={p.describedBy}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-[13px]"
            onChange={(e) => upload('screenshot', e.target.files?.[0])}
          />
        )}
      </Field>
      <Field label="Note" tone="app" helper="Optional.">
        {(p) => <Textarea tone="app" id={p.id} aria-describedby={p.describedBy} name="note" rows={2} maxLength={500} />}
      </Field>
      {uploadError || (state.error && !pending) ? (
        <p role="alert" className="m-0 text-[14px] text-flagged">
          {uploadError ?? state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        tone="app"
        loading={pending}
        disabled={!files.recording || !!uploading.recording || !!uploading.screenshot}
      >
        {uploading.recording || uploading.screenshot ? 'Uploading' : 'Send verification'}
      </Button>
    </form>
  )
}
