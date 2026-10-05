'use client'

import { Button, ErrorState } from '@mde/ui'
import { AdminPage } from '../_components/ui'

export default function SettingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <AdminPage title="Settings">
      <ErrorState
        title="Settings did not load."
        body="Nothing was changed. Try again."
        action={
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </AdminPage>
  )
}
