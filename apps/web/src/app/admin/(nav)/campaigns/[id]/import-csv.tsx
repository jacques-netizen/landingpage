'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { ImportResult } from '@/server/csv-import'
import { importCsvAction } from './import-actions'

// "Add posts from a CSV" on the campaign's Clips tab (owner request, 2026-10-30). Staff style, like the
// rest of the campaign workspace.
const TEMPLATE =
  'url,clipper,status\nhttps://www.tiktok.com/@page/video/7697296279830940944,clipperusername,approved\nhttps://www.instagram.com/reel/DeZUhxLiDww/,clipper@example.com,\n'
const TONE: Record<string, string> = { added: '#4FB286', approved: '#4FB286', skipped: '#9A958C', error: '#F08A80' }

export function ImportCsv({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, start] = useTransition()
  return (
    <section aria-label="Add posts from a CSV" className="rounded-[14px] border border-solid border-line bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 font-app text-[15px] font-semibold">Add posts from a CSV</h2>
          <p className="mt-1 mb-0 text-[12px] text-muted">
            One post per row: its link and the clipper&apos;s username, email or handle. Add &quot;approved&quot; in a
            status column to approve it at once; otherwise it waits in Review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 font-app text-[12px] text-muted-2 hover:text-ink"
        >
          {open ? 'Close' : 'Import a CSV'}
        </button>
      </div>
      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
            download="posts-template.csv"
            className="text-[12px] text-gold-soft"
          >
            Download a template
          </a>
          <input
            type="file"
            aria-label="CSV file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setResult(null)
            }}
            className="text-[12px]"
          />
          <div>
            <button
              type="button"
              disabled={!file || busy}
              onClick={() =>
                start(async () => {
                  const text = await file!.text()
                  const r = await importCsvAction(campaignId, text)
                  setResult(r)
                  if (r.ok) router.refresh()
                })
              }
              className="h-9 cursor-pointer rounded-[8px] border-0 bg-gold-soft px-4 font-app text-[13px] font-semibold text-[#1A1510] disabled:opacity-60"
            >
              {busy ? 'Adding posts' : 'Add posts'}
            </button>
          </div>
          {result && !result.ok ? (
            <p role="alert" className="m-0 text-[13px] text-[#F08A80]">
              {result.error}
            </p>
          ) : null}
          {result?.ok ? (
            <div role="status" className="flex flex-col gap-2">
              <p className="m-0 text-[13px]">
                {result.added} added{result.approved ? ` (${result.approved} approved)` : ''}
                {result.skipped ? `, ${result.skipped} skipped` : ''}
                {result.errors ? `, ${result.errors} with a problem` : ''}.
              </p>
              {result.rows.some((r) => r.result === 'error' || r.result === 'skipped') ? (
                <div className="max-h-[280px] overflow-auto rounded-[10px] border border-solid border-line">
                  <table className="w-full border-collapse text-[12px]">
                    <thead className="bg-field">
                      <tr className="text-left text-muted">
                        <th scope="col" className="px-3 py-2 font-medium">
                          Row
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Link
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          What happened
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows
                        .filter((r) => r.result === 'error' || r.result === 'skipped')
                        .map((r) => (
                          <tr key={r.row} className="border-0 border-t border-solid border-line">
                            <td className="px-3 py-2 tabular-nums">{r.row}</td>
                            <td className="max-w-[320px] truncate px-3 py-2">{r.url || 'No link'}</td>
                            <td className="px-3 py-2" style={{ color: TONE[r.result] }}>
                              {r.detail}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
