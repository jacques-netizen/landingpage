'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createReportAction } from './report-actions'

// Create a client report: weekly (with its week number) or final. Claude writes it from the data.
const field = 'h-9 w-full rounded-[8px] border border-solid border-line bg-field-2 px-3 font-app text-[13px] text-ink'

export function NewReport({
  campaignId,
  artist: artistGuess,
  nextWeek,
}: {
  campaignId: string
  artist: string
  nextWeek: number
}) {
  const router = useRouter()
  const [kind, setKind] = useState<'week' | 'final'>('week')
  const [week, setWeek] = useState(String(nextWeek))
  const [artist, setArtist] = useState(artistGuess)
  const [handle, setHandle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, start] = useTransition()
  const slug = `${artist
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}-${kind === 'week' ? `week-${week || 'n'}` : 'final'}`

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await createReportAction(campaignId, {
            kind,
            weekNumber: kind === 'week' ? Number(week) : null,
            artist,
            preparedFor: handle,
          })
          if (!r.ok) return setError(r.error)
          const q = r.message ? `?notice=${encodeURIComponent(r.message)}` : ''
          router.push(`/admin/campaigns/${campaignId}/reports/${r.id}${q}`)
        })
      }}
    >
      <div className="flex gap-2" role="radiogroup" aria-label="Kind of report">
        {(
          [
            ['week', 'Weekly report'],
            ['final', 'Final report'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`h-9 cursor-pointer rounded-pill border border-solid px-4 font-app text-[13px] ${
              kind === k
                ? 'border-gold-soft bg-[rgba(216,197,143,0.12)] text-gold-soft'
                : 'border-line bg-transparent text-muted-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <label className="text-[12px] text-muted-2">
          Artist name
          <input value={artist} onChange={(e) => setArtist(e.target.value)} className={`mt-1 ${field}`} required />
        </label>
        {kind === 'week' ? (
          <label className="text-[12px] text-muted-2">
            Week
            <input
              inputMode="numeric"
              value={week}
              onChange={(e) => setWeek(e.target.value.replace(/[^0-9]/g, ''))}
              className={`mt-1 ${field}`}
              required
            />
          </label>
        ) : null}
        {kind === 'week' ? (
          <label className="text-[12px] text-muted-2">
            Prepared for (optional)
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@artisthandle"
              className={`mt-1 ${field}`}
            />
          </label>
        ) : null}
      </div>
      <p className="m-0 text-[12px] text-muted">
        Address: app.maisondelites.com/reports/{slug}. Claude writes it from this campaign&apos;s data; it stays a draft
        until you publish it.
      </p>
      {error ? (
        <p role="alert" className="m-0 text-[12px] text-[#F08A80]">
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={busy}
          className="h-9 cursor-pointer rounded-[8px] border-0 bg-gold-soft px-4 font-app text-[13px] font-semibold text-[#1A1510] disabled:opacity-60"
        >
          {busy ? 'Claude is writing the report' : 'Create report'}
        </button>
      </div>
    </form>
  )
}
