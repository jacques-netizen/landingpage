'use client'

import { useState, useTransition } from 'react'
import { createReportLinkAction } from './report-link-actions'

// "Copy client report link" in the workspace header (owner brief, 2026-10-15): makes a link and puts it
// on the clipboard. Revoking links stays on the Settings tab.
export function CopyReportLink({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<{ text: string; url?: string } | null>(null)
  const [busy, start] = useTransition()
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await createReportLinkAction(campaignId)
            if (!r.ok) return setState({ text: r.error })
            let copied = false
            try {
              if (r.url) {
                await navigator.clipboard.writeText(r.url)
                copied = true
              }
            } catch {
              // No clipboard: the link is shown to copy by hand.
            }
            setState({ text: copied ? 'Copied.' : 'Copy this link:', url: copied ? undefined : r.url })
          })
        }
        className="inline-flex h-9 cursor-pointer items-center rounded-pill border border-solid border-[rgba(216,197,143,0.35)] bg-[rgba(216,197,143,0.1)] px-4 font-app text-[13px] font-medium text-gold-soft disabled:opacity-60"
      >
        {busy ? 'Making the link' : 'Copy client report link'}
      </button>
      {state ? (
        <span role="status" className="max-w-[320px] text-right text-[11px] break-all text-muted-2">
          {state.text}
          {state.url ? (
            <>
              {' '}
              <a href={state.url} target="_blank" rel="noreferrer">
                {state.url}
              </a>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
