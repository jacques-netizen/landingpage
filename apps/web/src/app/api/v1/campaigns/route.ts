import { db } from '@mde/db'
import { listCampaigns } from '@mde/partners'
import { apiBase, apiError, json, pageParams, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const GET = (req: Request) =>
  withKey(req, async (key) => {
    const p = pageParams(req)
    if (p instanceof Response) return p
    const status = new URL(req.url).searchParams.get('status')
    if (status !== null && status !== 'live' && status !== 'ended')
      return apiError('invalid_request', 'status must be live or ended.')
    return json(await listCampaigns(db(), key, apiBase(), { ...p, status }))
  })
