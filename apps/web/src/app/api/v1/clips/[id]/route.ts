import { db } from '@mde/db'
import { getClip } from '@mde/partners'
import { apiError, json, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withKey(req, async (key) => {
    const c = await getClip(db(), key, (await params).id)
    return c ? json(c) : apiError('not_found', 'No clip with that id for this key.')
  })
