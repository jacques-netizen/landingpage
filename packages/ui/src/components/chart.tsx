'use client'
import { useState } from 'react'
import { cn } from './cn'
import { Table, TBody, TD, TH, THead, TR } from './table'

export type ChartPoint = { label: string; value: number }

/**
 * One chart style: a single 1.5px black line, hairline grid, no fills,
 * a dot on the latest point. A text summary and a table view are always available.
 * Values are counts (views). For money, pass cents and a formatter.
 */
export function LineChart({
  points,
  summary,
  formatValue = (v) => v.toLocaleString('en-US'),
  valueLabel = 'Views',
  className,
}: {
  points: ChartPoint[]
  summary: string
  formatValue?: (value: number) => string
  valueLabel?: string
  className?: string
}) {
  const [showTable, setShowTable] = useState(false)
  const W = 640
  const H = 200
  const pad = { l: 8, r: 12, t: 12, b: 12 }
  const max = Math.max(1, ...points.map((p) => p.value))
  const x = (i: number) =>
    pad.l + (points.length < 2 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]

  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <figcaption className="flex items-start justify-between gap-4">
        <span className="text-body-sm text-ink-2">{summary}</span>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
          className="min-h-11 shrink-0 px-1 text-body-sm text-ink underline-offset-4 hover:underline"
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </figcaption>
      {showTable ? (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH className="text-right">{valueLabel}</TH>
            </TR>
          </THead>
          <TBody>
            {points.map((p) => (
              <TR key={p.label}>
                <TD>{p.label}</TD>
                <TD numeric>{formatValue(p.value)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
          {[0, 1, 2, 3].map((g) => {
            const gy = pad.t + (g / 3) * (H - pad.t - pad.b)
            return (
              <line
                key={g}
                x1={pad.l}
                x2={W - pad.r}
                y1={gy}
                y2={gy}
                stroke="var(--line)"
                strokeWidth={1}
              />
            )
          })}
          {points.length > 1 && (
            <path
              d={path}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}
          {last && (
            <circle cx={x(points.length - 1)} cy={y(last.value)} r={3.5} fill="var(--ink)" />
          )}
        </svg>
      )}
    </figure>
  )
}
