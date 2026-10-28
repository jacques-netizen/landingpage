import { db } from '@mde/db'
import { dailyStats } from '@mde/partners'
import { apiError, json, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withKey(req, async (key) => {
    const d = await dailyStats(db(), key, (await params).id)
    return d ? json(d) : apiError('not_found', 'No campaign with that id for this key.')
  })
