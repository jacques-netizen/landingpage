'use client'

import { Button, Dialog } from '@mde/ui'
import { useActionState, useState } from 'react'
import { Notice } from '../_components/ui'
import { campaignAction, type BuilderState } from './actions'

type Props = {
  id: string
  can: { publish: boolean; fund: boolean; close: boolean; cancel: boolean; copy: boolean; delete?: boolean }
  /** Whether deleting keeps the campaign's records (it has money or posts) or removes it. */
  keepsRecords?: boolean
  fundLabel: string
  /** The one-step go live: what the client owes and what is still missing. */
  goLive?: { lines: [string, string][]; missing: string[]; owedNow: string } | null
}

// The actions a campaign allows in its current state. Close and cancel ask for confirmation.
export function CampaignActions({ id, can, fundLabel, goLive, keepsRecords }: Props) {
  const [state, action, pending] = useActionState<BuilderState, FormData>(campaignAction.bind(null, id), {})
  const [confirm, setConfirm] = useState<null | 'close' | 'cancel' | 'delete'>(null)
  const [reference, setReference] = useState('')
  const submit = (what: string) => {
    const f = new FormData()
    f.set('action', what)
    f.set('reference', reference)
    action(f)
  }
  return (
    <div>
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {goLive ? (
        <div className="mb-6 max-w-[560px] rounded-card border border-solid border-line bg-field p-6">
          <h3 className="m-0 font-app text-[16px] font-semibold">Go live</h3>
          <dl className="mt-4 mb-0 flex flex-col gap-2 text-[14px]">
            {goLive.lines.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-2">{k}</dt>
                <dd className="m-0 tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {goLive.missing.length ? (
            <p className="mt-4 mb-0 text-[14px] text-bad">
              Before it can go live, add the {goLive.missing.join(', ')} below and save.
            </p>
          ) : (
            <>
              <label className="mt-5 flex flex-col gap-2 text-[13px] font-medium">
                Invoice or payment reference (optional)
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="INV-1042"
                  className="h-10 rounded-input border border-solid border-sand bg-white px-3 text-[14px] font-normal"
                />
              </label>
              <div className="mt-5">
                <Button onClick={() => submit('golive')} loading={pending} arrow>
                  {goLive.owedNow === '$0.00' ? 'Go live' : `Client paid ${goLive.owedNow}: go live`}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {can.fund && !goLive ? (
          <Button size="sm" onClick={() => submit('fund')} loading={pending}>
            {fundLabel}
          </Button>
        ) : null}
        {can.publish && !goLive ? (
          <Button size="sm" onClick={() => submit('publish')} disabled={pending} arrow>
            Publish
          </Button>
        ) : null}
        {can.copy ? (
          <Button size="sm" variant="secondary" onClick={() => submit('copy')} disabled={pending}>
            Copy for next month
          </Button>
        ) : null}
        {can.close ? (
          <Button size="sm" variant="destructive" onClick={() => setConfirm('close')} disabled={pending}>
            Close campaign
          </Button>
        ) : null}
        {can.cancel ? (
          <Button size="sm" variant="destructive" onClick={() => setConfirm('cancel')} disabled={pending}>
            Cancel campaign
          </Button>
        ) : null}
        {can.delete ? (
          <Button size="sm" variant="destructive" onClick={() => setConfirm('delete')} disabled={pending}>
            Delete campaign
          </Button>
        ) : null}
      </div>
      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === 'close'
            ? 'Close this campaign?'
            : confirm === 'delete'
              ? 'Delete this campaign?'
              : 'Cancel this campaign?'
        }
        description={
          confirm === 'close'
            ? 'No new earnings after this. Posts become final and earnings are released after the review window. This cannot be undone.'
            : confirm === 'delete'
              ? keepsRecords
                ? 'It disappears from the admin and the campaigns screen. Money has moved or creators have posted, so it is closed first and its records are kept for the books: earnings are still paid and the unspent budget goes back to the client. This cannot be undone.'
                : 'It is removed completely. This cannot be undone.'
              : 'The campaign will not run. This cannot be undone.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const what = confirm!
                setConfirm(null)
                submit(what)
              }}
            >
              {confirm === 'close' ? 'Close campaign' : confirm === 'delete' ? 'Delete campaign' : 'Cancel campaign'}
            </Button>
          </>
        }
      />
    </div>
  )
}
