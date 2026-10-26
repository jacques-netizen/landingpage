'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { RuleProblem, StaleFlag } from '@/reports/rules'
import type { ReportSpec, SectionKey } from '@/reports/spec'
import { reportAction } from '../../report-actions'

// The report editor (owner brief, 2026-10-26): a live preview beside the instruction box. Claude makes
// typed changes; switches, clip order, undo and restore are made here directly. Every change is a version.

type Version = {
  id: string
  number: number
  note: string
  by: string | null
  at: string
  current: boolean
  published: boolean
}
const panel = 'rounded-[14px] border border-solid border-line bg-panel p-4'
const h2 = 'm-0 font-app text-[14px] font-semibold'
const btn =
  'h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 font-app text-[12px] text-muted-2 hover:text-ink disabled:opacity-50'
const gold =
  'h-9 cursor-pointer rounded-[8px] border-0 bg-gold-soft px-4 font-app text-[13px] font-semibold text-[#1A1510] disabled:opacity-60'
const when = (iso: string) => iso.replace('T', ' ').slice(0, 16) + ' UTC'

export function ReportEditor(p: {
  campaignId: string
  reportId: string
  kind: 'week' | 'final'
  status: 'draft' | 'published'
  locked: boolean
  slug: string
  versionId: string
  canUndo: boolean
  unpublished: boolean
  show: ReportSpec['show']
  sections: { key: SectionKey; label: string; on: boolean; empty: boolean; why: string }[]
  clips: { id: string; label: string; shown: boolean }[]
  order: string[]
  stale: StaleFlag[]
  publishedStale: StaleFlag[]
  versions: Version[]
}) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [text, setText] = useState('')
  const [error, setError] = useState<{ text: string; problems?: RuleProblem[] } | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [phone, setPhone] = useState(false)
  const [order, setOrder] = useState(p.order)
  const [show, setShow] = useState(p.show)
  const [drag, setDrag] = useState<number | null>(null)
  const orderChanged = order.join() !== p.order.join()
  const label = (id: string) => p.clips.find((c) => c.id === id)?.label ?? id

  const run = (a: Parameters<typeof reportAction>[2], after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await reportAction(p.campaignId, p.reportId, a)
      if (!r.ok) {
        setShow(p.show)
        return setError({ text: r.error, problems: r.problems })
      }
      after?.()
      if (a.do === 'delete') return router.push(`/admin/campaigns/${p.campaignId}?tab=reports`)
      setViewing(null)
      router.refresh()
    })

  const src = `/admin/report-preview/${p.reportId}?v=${viewing ?? p.versionId}`
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return
    const next = [...order]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x!)
    setOrder(next)
  }
  const publicUrl = `/reports/${p.slug}`

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-4 max-lg:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
          <span>
            {viewing
              ? `Showing version ${p.versions.find((v) => v.id === viewing)?.number}`
              : 'Preview with the latest numbers'}
          </span>
          <div className="flex gap-2">
            {viewing ? (
              <button type="button" className={btn} onClick={() => setViewing(null)}>
                Back to the current version
              </button>
            ) : null}
            <button type="button" className={btn} onClick={() => setPhone(!phone)} aria-pressed={phone}>
              {phone ? 'Full width' : 'Phone width'}
            </button>
            <a
              className={`${btn} inline-flex items-center no-underline`}
              href={`${src}&print=1`}
              target="_blank"
              rel="noopener"
            >
              PDF layout
            </a>
          </div>
        </div>
        <div className="flex justify-center rounded-[14px] border border-solid border-line bg-[#0e0c09] p-2">
          <iframe
            key={src}
            title="Report preview"
            src={src}
            className="h-[78vh] rounded-[10px] border-0 bg-[#15120D]"
            style={{ width: phone ? 390 : '100%' }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <section className={panel} aria-label="Publishing">
          <h2 className={h2}>{p.status === 'published' ? 'Published' : 'Draft'}</h2>
          <p className="mt-1 mb-3 text-[12px] text-muted">
            {p.locked
              ? 'This weekly report is frozen with the numbers it had when published. Unlock it to edit; it goes offline until published again.'
              : p.kind === 'week'
                ? 'Publishing freezes the report with today’s numbers.'
                : 'A final report shows the numbers of the moment it is opened. Its words stay as published.'}
            {p.unpublished && !p.locked ? ' The version below has changes the public page does not have yet.' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {p.locked ? (
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() => confirm('Take this report offline and unlock it for editing?') && run({ do: 'unlock' })}
              >
                Unlock to edit
              </button>
            ) : (
              <button
                type="button"
                className={gold}
                disabled={busy || (p.status === 'published' && !p.unpublished)}
                onClick={() => run({ do: 'publish' })}
              >
                {p.status === 'published' ? (p.unpublished ? 'Publish changes' : 'Up to date') : 'Publish'}
              </button>
            )}
            {p.status === 'published' ? (
              <>
                <a
                  className={`${btn} inline-flex items-center no-underline`}
                  href={publicUrl}
                  target="_blank"
                  rel="noopener"
                >
                  Open page
                </a>
                <a
                  className={`${btn} inline-flex items-center no-underline`}
                  href={`${publicUrl}.pdf`}
                  target="_blank"
                  rel="noopener"
                >
                  Download PDF
                </a>
                <button
                  type="button"
                  className={btn}
                  onClick={() => navigator.clipboard?.writeText(`${location.origin}${publicUrl}`)}
                >
                  Copy link
                </button>
              </>
            ) : null}
          </div>
        </section>

        {p.publishedStale.length || p.stale.length ? (
          <section className={`${panel} border-[rgba(224,169,74,0.45)]`} aria-label="Numbers that changed">
            <h2 className={h2}>Numbers that changed</h2>
            <p className="mt-1 mb-2 text-[12px] text-muted">
              These sentences quote a figure that is different now. The text is never changed by itself: type an
              instruction to update it, or leave it.
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[12px]">
              {(p.publishedStale.length ? p.publishedStale : p.stale).map((f, i) => (
                <li key={i} className="rounded-[8px] bg-field px-3 py-2">
                  <b className="text-ink">{f.where}</b>: “{f.text.replace(/\*\*/g, '')}”
                  <div className="mt-1 text-pending">
                    {f.figure}: was {f.was}, now {f.now}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={panel} aria-label="Ask Claude">
          <h2 className={h2}>Change the report</h2>
          <textarea
            aria-label="What to change"
            value={text}
            disabled={p.locked || busy}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="For example: make the summary heading about reach, or add a plan step about diaspora pages"
            className="mt-2 w-full resize-y rounded-[8px] border border-solid border-line bg-field-2 p-3 font-app text-[13px] text-ink"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={gold}
              disabled={p.locked || busy || !text.trim()}
              onClick={() => run({ do: 'instruct', text }, () => setText(''))}
            >
              {busy ? 'Working' : 'Apply'}
            </button>
            <button
              type="button"
              className={btn}
              disabled={p.locked || busy || !p.canUndo}
              onClick={() => run({ do: 'undo' })}
            >
              Undo
            </button>
          </div>
          {error ? (
            <div role="alert" className="mt-2 text-[12px] text-[#F08A80]">
              {error.text}
              {error.problems?.length ? (
                <ul className="mt-1 mb-0 pl-4">
                  {error.problems.slice(0, 8).map((x, i) => (
                    <li key={i}>
                      {x.where} {x.problem}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={panel} aria-label="Sections">
          <h2 className={h2}>Sections</h2>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
            {p.sections.map((s) => (
              <li key={s.key}>
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={show[s.key]}
                    disabled={p.locked || busy}
                    onChange={(e) => {
                      const next = { ...show, [s.key]: e.target.checked }
                      setShow(next)
                      run({ do: 'show', show: next })
                    }}
                  />
                  {s.label}
                  {s.empty ? <span className="text-[11px] text-muted">({s.why})</span> : null}
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className={panel} aria-label="Clips shown">
          <h2 className={h2}>Clips shown</h2>
          <p className="mt-1 mb-2 text-[12px] text-muted">Drag to reorder. Up to six.</p>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {order.map((id, i) => (
              <li
                key={id}
                draggable={!p.locked}
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag !== null) move(drag, i)
                  setDrag(null)
                }}
                className="flex cursor-grab items-center gap-2 rounded-[8px] border border-solid border-line bg-field px-2 py-[6px] text-[12px]"
              >
                <span className="w-4 text-gold-soft">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{label(id)}</span>
                <button
                  type="button"
                  aria-label="Move up"
                  className="cursor-pointer border-0 bg-transparent text-muted-2"
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  className="cursor-pointer border-0 bg-transparent text-muted-2"
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  className="cursor-pointer border-0 bg-transparent text-muted-2"
                  onClick={() => setOrder(order.filter((x) => x !== id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          {order.length < 6 ? (
            <select
              aria-label="Add a clip"
              value=""
              disabled={p.locked}
              onChange={(e) => e.target.value && setOrder([...order, e.target.value])}
              className="mt-2 h-8 w-full rounded-[8px] border border-solid border-line bg-field-2 px-2 font-app text-[12px] text-ink"
            >
              <option value="">Add a clip</option>
              {p.clips
                .filter((c) => !order.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
          ) : null}
          {orderChanged ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={gold}
                disabled={busy || !order.length}
                onClick={() => run({ do: 'order', order })}
              >
                Save clip order
              </button>
              <button type="button" className={btn} onClick={() => setOrder(p.order)}>
                Cancel
              </button>
            </div>
          ) : null}
        </section>

        <section className={panel} aria-label="Versions">
          <h2 className={h2}>Versions</h2>
          <ol className="m-0 mt-2 flex max-h-[360px] list-none flex-col gap-1 overflow-y-auto p-0">
            {p.versions.map((v) => (
              <li
                key={v.id}
                className={`rounded-[8px] px-2 py-[6px] text-[12px] ${v.current ? 'bg-[rgba(216,197,143,0.1)]' : 'bg-field'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-ink">
                    {v.number}
                    {v.current ? ' · editing' : ''}
                    {v.published ? ' · public' : ''}
                  </b>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-gold-soft"
                      onClick={() => setViewing(v.id)}
                    >
                      View
                    </button>
                    {!v.current && !p.locked ? (
                      <button
                        type="button"
                        className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-gold-soft"
                        disabled={busy}
                        onClick={() => run({ do: 'restore', versionId: v.id })}
                      >
                        Restore
                      </button>
                    ) : null}
                  </span>
                </div>
                <div className="text-muted-2">{v.note}</div>
                <div className="text-[11px] text-muted">
                  {when(v.at)}
                  {v.by ? ` · ${v.by}` : ''}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <button
          type="button"
          className={`${btn} self-start`}
          disabled={busy}
          onClick={() =>
            confirm('Delete this report and every version of it? Its address stops working.') && run({ do: 'delete' })
          }
        >
          Delete report
        </button>
      </div>
    </div>
  )
}
