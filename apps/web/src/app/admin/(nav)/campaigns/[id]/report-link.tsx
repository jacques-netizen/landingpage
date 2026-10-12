'use client'

import { Button, Dialog } from '@mde/ui'
import { useState, useTransition } from 'react'
import { Notice } from '../../_components/ui'
import { createReportLinkAction, revokeReportLinksAction, type ReportLinkResult } from './report-link-actions'

// "Create report link" and "Revoke report links" on the staff campaign page (client report brief).
export function ReportLink({ campaignId, hasLinks }: { campaignId: string; hasLinks: boolean }) {
  const [result, setResult] = useState<ReportLinkResult | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, start] = useTransition()
  const url = result?.ok ? result.url : undefined
  // A link made just now can be revoked at once, before the page data is refreshed.
  const linksExist = hasLinks || !!url

  const create = () =>
    start(async () => {
      const r = await createReportLinkAction(campaignId)
      if (r.ok && r.url) {
        try {
          await navigator.clipboard.writeText(r.url)
        } catch {
          // No clipboard (an old browser, or no permission): the link is shown to copy by hand.
        }
      }
      setResult(r)
    })

  return (
    <section
      aria-label="Client report link"
      className="mt-4 rounded-[14px] border border-solid border-line bg-panel p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 font-app text-[15px] font-semibold">Client report</h2>
          <p className="mt-1 mb-0 text-[12px] text-muted">
            A read-only page of this campaign's performance, open to anyone with the link. No login.
            {linksExist ? ' Links have been created for this campaign.' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={create} loading={busy}>
            Create report link
          </Button>
          {linksExist ? (
            <Button size="sm" variant="destructive" onClick={() => setConfirm(true)} disabled={busy}>
              Revoke report links
            </Button>
          ) : null}
        </div>
      </div>
      {result ? (
        <div className="mt-4">
          {result.ok ? <Notice kind="ok">{result.message}</Notice> : <Notice kind="bad">{result.error}</Notice>}
        </div>
      ) : null}
      {url ? (
        <input
          readOnly
          value={url}
          aria-label="Report link"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 h-10 w-full rounded-[10px] border border-solid border-line bg-field px-3 font-mono text-[12px] text-ink"
        />
      ) : null}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Revoke every report link?"
        description="Links already shared with the client stop working at once. You can create a new one afterwards."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Keep them
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirm(false)
                start(async () => setResult(await revokeReportLinksAction(campaignId)))
              }}
            >
              Revoke links
            </Button>
          </>
        }
      />
    </section>
  )
}
