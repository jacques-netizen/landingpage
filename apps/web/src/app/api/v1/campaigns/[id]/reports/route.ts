import { db } from '@mde/db'
import { campaignReports } from '@mde/partners'
import { apiBase, apiError, json, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withKey(req, async (key) => {
    const r = await campaignReports(db(), key, apiBase(), (await params).id)
    return r ? json(r) : apiError('not_found', 'No campaign with that id for this key.')
  })
