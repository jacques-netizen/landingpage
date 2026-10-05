'use client'

import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { formatDollars } from '@mde/money/dollars'
import { Button, Drawer, DrawerSection, LineChart, LoadingRows } from '@mde/ui'
import { useState, useTransition } from 'react'
import { STATUS_COLOURS } from '@/components/app-ui'
import { LocalDateTime } from '@/components/local-time'
import { submissionDetailAction, type SubmissionDetail } from './actions'

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

export function SubmissionsTable({ rows, theme }: { rows: Row[]; theme: 'dark' | 'glass' }) {
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
                <td className={`${td} text-right tabular-nums`}>{count(r.latestViews)}</td>
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
          <Detail d={detail} />
        )}
      </Drawer>
    </>
  )
}

function Detail({ d }: { d: SubmissionDetail }) {
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
      </DrawerSection>

      {d.reason || d.reasonNote ? (
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
        {d.appeal ? (
          <p className="mt-3 mb-0 text-[13px]">
            Appeal {d.appeal.status === 'open' ? 'open, waiting for a reply' : d.appeal.status}.
            {d.appeal.reply ? ` ${d.appeal.reply}` : ''}
          </p>
        ) : null}
      </DrawerSection>

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
