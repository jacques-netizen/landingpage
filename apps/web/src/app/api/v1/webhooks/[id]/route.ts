import { db } from '@mde/db'
import { deleteWebhook } from '@mde/partners'
import { apiError, json, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withKey(req, async (key) => {
    const { id } = await params
    return (await deleteWebhook(db(), key, id))
      ? json({ id, object: 'webhook', deleted: true })
      : apiError('not_found', 'No webhook with that id for this key.')
  })
