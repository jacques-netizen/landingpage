import type { CampaignFigures } from '@mde/campaigns'

/**
 * What creators see for a campaign's budget. Once it has ended, nothing is left to earn, so it shows
 * $0.00 left and a full bar (owner request, 2026-10-07). Display only: the ledger is unchanged, and
 * the unspent budget goes back to the client as before. Staff screens keep the real figures.
 */
export function shownFigures(status: string, f: CampaignFigures): CampaignFigures {
  return status === 'closed' ? { ...f, leftCents: 0, paidPercent: 100 } : f
}
