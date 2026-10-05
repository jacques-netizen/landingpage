'use client'

import { Button } from '@mde/ui'
import { useActionState } from 'react'

export type PrefsState = { ok?: string; error?: string }

// Two switches (03_SYSTEMS.md section 9). In-app notifications are always on.
export function PrefsForm({
  action,
  email,
  newCampaigns,
}: {
  action: (prev: PrefsState, form: FormData) => Promise<PrefsState>
  email: boolean
  newCampaigns: boolean
}) {
  const [state, run, pending] = useActionState<PrefsState, FormData>(action, {})
  const box = 'mt-[3px] size-[18px] flex-none cursor-pointer'
  return (
    <form action={run} className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-3 text-[14px]">
        <input type="checkbox" name="email" defaultChecked={email} className={box} style={{ accentColor: '#D8C58F' }} />
        <span>
          <span className="font-semibold">Email me about my account</span>
          <span className="mt-1 block text-[13px] text-[var(--t-muted)]">
            Decisions on your posts, earnings, appeals and warnings. You always see them here too.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-[14px]">
        <input
          type="checkbox"
          name="newCampaigns"
          defaultChecked={newCampaigns}
          className={box}
          style={{ accentColor: '#D8C58F' }}
        />
        <span>
          <span className="font-semibold">Tell me about new campaigns</span>
          <span className="mt-1 block text-[13px] text-[var(--t-muted)]">
            When a campaign opens on a platform where you have a verified account.
          </span>
        </span>
      </label>
      {state.error && !pending ? (
        <p role="alert" className="m-0 text-[14px] text-flagged">
          {state.error}
        </p>
      ) : null}
      {state.ok && !pending ? (
        <p role="status" className="m-0 text-[14px]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" tone="app" size="sm" loading={pending}>
          Save preferences
        </Button>
      </div>
    </form>
  )
}
