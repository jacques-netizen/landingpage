'use client'

import { Button } from '@mde/ui'
import { useState, useTransition } from 'react'
import { Notice } from '../_components/ui'
import { createDemoAction, type DemoActionState } from './actions'

export function DemoButton({ slug, title }: { slug: string; title: string }) {
  const [busy, start] = useTransition()
  const [state, setState] = useState<DemoActionState>({})
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="sm"
        loading={busy}
        onClick={() => start(async () => setState(await createDemoAction(slug)))}
      >
        Create {title}
      </Button>
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
    </div>
  )
}
