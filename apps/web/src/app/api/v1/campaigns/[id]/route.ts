import { db } from '@mde/db'
import { getCampaign } from '@mde/partners'
import { apiBase, apiError, json, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withKey(req, async (key) => {
    const c = await getCampaign(db(), key, apiBase(), (await params).id)
    return c ? json(c) : apiError('not_found', 'No campaign with that id for this key.')
  })
