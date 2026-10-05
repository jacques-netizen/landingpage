'use client'

import { Button, ErrorState } from '@mde/ui'

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="This page did not load."
      body="Nothing was lost. Try again in a moment."
      action={<Button onClick={reset}>Try again</Button>}
    />
  )
}
