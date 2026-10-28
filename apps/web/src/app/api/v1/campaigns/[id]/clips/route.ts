import { db } from '@mde/db'
import { listClips } from '@mde/partners'
import { apiError, json, pageParams, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withKey(req, async (key) => {
    const p = pageParams(req)
    if (p instanceof Response) return p
    const status = new URL(req.url).searchParams.get('status')
    if (status !== null && status !== 'approved' && status !== 'in_review')
      return apiError('invalid_request', 'status must be approved or in_review.')
    const page = await listClips(db(), key, (await params).id, { ...p, status })
    return page ? json(page) : apiError('not_found', 'No campaign with that id for this key.')
  })
