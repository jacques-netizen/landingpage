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
}: {
  points: Point[]
  title: string
  summary: string
  format?: (n: number) => string
}) {
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
    <figure className="m-0 font-sans" aria-describedby={`${id}-sum`}>
      <div className="flex items-center justify-between gap-4">
        <figcaption className="text-[12px] text-muted-2">{title}</figcaption>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className={cn(bare, focusRing, 'cursor-pointer text-[12px] text-muted-2 underline underline-offset-4')}
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
                <td className="border-0 border-b border-solid border-line py-2">{p.label}</td>
                <td className="border-0 border-b border-solid border-line py-2 text-right tabular-nums">
                  {format(p.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-3 h-60 border-0 border-y border-solid border-line">
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
            {points.length > 0 ? (
              <path d={d} fill="none" stroke="#1A1510" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
          {last ? (
            <span
              aria-hidden
              className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
              style={{ left: `${(last[0] / w) * 100}%`, top: last[1] }}
            />
          ) : null}
        </div>
      )}
    </figure>
  )
}
