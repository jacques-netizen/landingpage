// Campaign status as staff and creators read it: a word and a dot colour. Safe in the browser.
export const CAMPAIGN_STATUS: Record<string, { label: string; dot: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  draft: { label: 'Draft', dot: 'neutral' },
  awaiting_funding: { label: 'Waiting for funding', dot: 'warn' },
  live: { label: 'Live', dot: 'ok' },
  closing: { label: 'Closing', dot: 'warn' },
  closed: { label: 'Closed', dot: 'neutral' },
  cancelled: { label: 'Cancelled', dot: 'bad' },
}
