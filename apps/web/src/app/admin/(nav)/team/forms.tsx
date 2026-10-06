'use client'

import { Button, Field, Input, Select } from '@mde/ui'
import { useActionState, useState, useTransition } from 'react'
import { Notice } from '../_components/ui'
import { addMemberAction, removeRoleAction, type TeamState } from './actions'

export function AddMemberForm({ roles }: { roles: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(addMemberAction, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <div className="grid grid-cols-[2fr_1fr_auto] items-end gap-3 max-md:grid-cols-1">
        <Field label="Email">
          {(p) => <Input id={p.id} name="email" type="email" placeholder="name@example.com" autoComplete="off" />}
        </Field>
        <Field label="Role">{(p) => <Select id={p.id} name="role" defaultValue="reviewer" options={roles} />}</Field>
        <Button type="submit" loading={pending}>
          Add to team
        </Button>
      </div>
    </form>
  )
}

export function RemoveRole({ userId, role, label }: { userId: string; role: string; label: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="quiet"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            if (!window.confirm(`Remove ${label} access?`)) return
            const r = await removeRoleAction(userId, role)
            setError(r.error ?? null)
          })
        }
      >
        Remove
      </Button>
      {error ? <span className="text-[13px] text-bad">{error}</span> : null}
    </span>
  )
}
