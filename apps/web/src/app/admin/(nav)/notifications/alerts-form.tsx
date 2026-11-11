'use client'

import { Button } from '@mde/ui'
import { useActionState } from 'react'
import { Notice } from '../_components/ui'
import { savePayoutAlertsAction, type AlertsState } from './actions'

export function PayoutAlertsForm({ on, emailOn }: { on: boolean; emailOn: boolean }) {
  const [state, run, pending] = useActionState<AlertsState, FormData>(savePayoutAlertsAction, {})
  return (
    <form action={run} className="mb-6 flex flex-col gap-3 border-0 border-b border-solid border-line pb-6">
      {state.ok && !pending ? <Notice kind="ok">{state.ok}</Notice> : null}
      <label className="flex cursor-pointer items-start gap-3 text-[14px]">
        <input type="checkbox" name="payoutChanges" defaultChecked={on} className="mt-[3px] size-[18px] flex-none" />
        <span>
          <span className="font-semibold">Tell me when a clipper adds or changes their payout method</span>
          <span className="mt-1 block text-[13px] text-muted-2">
            Here and by email, with the old and new method (account numbers shortened).
            {emailOn ? '' : ' Your own email notifications are off, so you will see these here only.'}
          </span>
        </span>
      </label>
      <div>
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          Save
        </Button>
      </div>
    </form>
  )
}
