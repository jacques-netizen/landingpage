'use client'

import { useId, useState } from 'react'
import { bare, cn, focusRing } from './cn'

type Point = { label: string; value: number }

// One chart style: a single 1.5px ink line, hairlines above and below, no fill, a dot on the
// latest point. Every chart has a text summary and a table view toggle (05_DESIGN_SYSTEM.md section 10).
export function LineChart({
  points,
  title,
  summary,
  format = (n) => n.toLocaleString('en-US'),
  tone = 'paper',
}: {
  points: Point[]
  title: string
  summary: string
  format?: (n: number) => string
  /** App screens draw the line in the theme's text colour on the theme's hairlines. */
  tone?: 'paper' | 'app'
}) {
  const app = tone === 'app'
  const muted = app ? 'text-[var(--t-muted)]' : 'text-muted-2'
  const line = app ? 'border-[var(--t-hair)]' : 'border-line'
  const [asTable, setAsTable] = useState(false)
  const id = useId()
  const max = Math.max(1, ...points.map((p) => p.value))
  const w = 1000
  const h = 240
  const xy = points.map(
    (p, i) => [points.length === 1 ? w : (i / (points.length - 1)) * w, h - 20 - (p.value / max) * (h - 50)] as const,
  )
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = xy[xy.length - 1]
  return (
    <figure className={cn('m-0', app ? 'font-app' : 'font-sans')} aria-describedby={`${id}-sum`}>
      <div className="flex items-center justify-between gap-4">
        <figcaption className={cn('text-[12px]', muted)}>{title}</figcaption>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className={cn(bare, focusRing, 'cursor-pointer text-[12px] underline underline-offset-4', muted)}
        >
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      <p id={`${id}-sum`} className="sr-only">
        {summary}
      </p>
      {asTable ? (
        <table className="mt-3 w-full border-collapse text-[13px]">
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td className={cn('border-0 border-b border-solid py-2', line)}>{p.label}</td>
                <td className={cn('border-0 border-b border-solid py-2 text-right tabular-nums', line)}>
                  {format(p.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={cn('relative mt-3 h-60 border-0 border-y border-solid', line)}>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
            {points.length > 0 ? (
              <path
                d={d}
                fill="none"
                stroke={app ? 'var(--t-text)' : '#1A1510'}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {last ? (
            <span
              aria-hidden
              className={cn(
                'absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full',
                app ? 'bg-[var(--t-accent-ink)]' : 'bg-ink',
              )}
              style={{ left: `${(last[0] / w) * 100}%`, top: last[1] }}
            />
          ) : null}
        </div>
      )}
    </figure>
  )
}

// Bars in the same style as the line: ink bars on hairlines, a table behind a toggle. Values can go
// below zero (a day's money returned), drawn down from the zero line.
export function BarChart({
  points,
  title,
  summary,
  format = (n) => n.toLocaleString('en-US'),
  columns,
}: {
  points: (Point & { extra?: string })[]
  title: string
  summary: string
  format?: (n: number) => string
  /** Table headings: the label, the value, and the optional extra column. */
  columns?: [string, string, string?]
}) {
  const [asTable, setAsTable] = useState(false)
  const id = useId()
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)))
  const hasNegative = points.some((p) => p.value < 0)
  const w = 1000
  const h = 200
  const zero = hasNegative ? h / 2 : h - 10
  const scale = (hasNegative ? h / 2 - 10 : h - 20) / max
  const slot = points.length ? w / points.length : w
  const bar = Math.max(2, Math.min(24, slot * 0.6))
  const [a, b, c] = columns ?? ['Date', 'Value', undefined]
  return (
    <figure className="m-0 font-sans" aria-describedby={`${id}-sum`}>
      <div className="flex items-center justify-between gap-4">
        <figcaption className="text-[12px] text-muted-2">{title}</figcaption>
        <div
          role="group"
          aria-label="Show as"
          className="flex gap-[2px] rounded-pill border border-solid border-line p-[2px]"
        >
          {(['Chart', 'Table'] as const).map((k) => {
            const on = (k === 'Table') === asTable
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setAsTable(k === 'Table')}
                className={cn(
                  bare,
                  focusRing,
                  'cursor-pointer rounded-pill px-3 py-[3px] text-[12px]',
                  on ? 'bg-ink text-cream' : 'text-muted-2',
                )}
              >
                {k}
              </button>
            )
          })}
        </div>
      </div>
      <p id={`${id}-sum`} className="sr-only">
        {summary}
      </p>
      {asTable ? (
        <table className="mt-3 w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-muted-2">
              <th className="border-0 border-b border-solid border-line py-2 font-medium">{a}</th>
              <th className="border-0 border-b border-solid border-line py-2 text-right font-medium">{b}</th>
              {c ? (
                <th className="border-0 border-b border-solid border-line py-2 text-right font-medium">{c}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td className="border-0 border-b border-solid border-line py-2">{p.label}</td>
                <td className="border-0 border-b border-solid border-line py-2 text-right tabular-nums">
                  {format(p.value)}
                </td>
                {c ? (
                  <td className="border-0 border-b border-solid border-line py-2 text-right tabular-nums">{p.extra}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-3 h-[200px] border-0 border-y border-solid border-line">
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
            <line
              x1={0}
              x2={w}
              y1={zero}
              y2={zero}
              stroke="#1A1510"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => {
              const height = Math.abs(p.value) * scale
              const x = i * slot + (slot - bar) / 2
              return (
                <rect
                  key={p.label}
                  x={x}
                  y={p.value >= 0 ? zero - height : zero}
                  width={bar}
                  height={height}
                  fill={p.value >= 0 ? '#1A1510' : '#B26A00'}
                />
              )
            })}
          </svg>
        </div>
      )}
    </figure>
  )
}
