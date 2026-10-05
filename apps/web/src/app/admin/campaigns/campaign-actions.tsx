'use client'

import { Button, Dialog } from '@mde/ui'
import { useActionState, useState } from 'react'
import { Notice } from '../_components/ui'
import { campaignAction, type BuilderState } from './actions'

type Props = {
  id: string
  can: { publish: boolean; fund: boolean; close: boolean; cancel: boolean; copy: boolean }
  fundLabel: string
}

// The actions a campaign allows in its current state. Close and cancel ask for confirmation.
export function CampaignActions({ id, can, fundLabel }: Props) {
  const [state, action, pending] = useActionState<BuilderState, FormData>(campaignAction.bind(null, id), {})
  const [confirm, setConfirm] = useState<null | 'close' | 'cancel'>(null)
  const submit = (what: string) => {
    const f = new FormData()
    f.set('action', what)
    action(f)
  }
  return (
    <div>
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        {can.fund ? (
          <Button size="sm" onClick={() => submit('fund')} loading={pending}>
            {fundLabel}
          </Button>
        ) : null}
        {can.publish ? (
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
      </div>
      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'close' ? 'Close this campaign?' : 'Cancel this campaign?'}
        description={
          confirm === 'close'
            ? 'No new earnings after this. Posts become final and earnings are released after the review window. This cannot be undone.'
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
              {confirm === 'close' ? 'Close campaign' : 'Cancel campaign'}
            </Button>
          </>
        }
      />
    </div>
  )
}
