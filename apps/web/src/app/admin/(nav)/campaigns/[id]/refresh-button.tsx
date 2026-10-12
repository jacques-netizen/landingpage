'use client'

import { Button } from '@mde/ui'
import { useState, useTransition } from 'react'
import { Notice } from '../../_components/ui'
import { refreshCampaignStatsAction, type RefreshResult } from './refresh-actions'

export function RefreshButton({ campaignId }: { campaignId: string }) {
  const [result, setResult] = useState<RefreshResult | null>(null)
  const [busy, start] = useTransition()
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={() => start(async () => setResult(await refreshCampaignStatsAction(campaignId)))}
      >
        Refresh stats now
      </Button>
      {result ? <Notice kind={result.checked > 0 ? 'ok' : 'bad'}>{result.message}</Notice> : null}
    </div>
  )
}
