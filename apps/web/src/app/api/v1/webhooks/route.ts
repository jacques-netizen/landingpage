import { db } from '@mde/db'
import { createWebhook, listWebhooks, toApi, WebhookError } from '@mde/partners'
import { z } from 'zod'
import { apiError, json, withKey } from '@/server/partner-api'

// The request body, checked strictly (2026-11-13): known fields only, with their types and lengths.
const body = z
  .object({
    url: z.string().min(1).max(2000),
    events: z.array(z.string().max(64)).min(1).max(10),
  })
  .strict()

export const dynamic = 'force-dynamic'

export const GET = (req: Request) =>
  withKey(req, async (key) => json({ object: 'list', data: (await listWebhooks(db(), key)).map(toApi) }))

// The secret is in this answer only: it signs every delivery and is never shown again.
export const POST = (req: Request) =>
  withKey(req, async (key) => {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return apiError('invalid_request', 'Send a JSON body with url and events.')
    }
    const parsed = body.safeParse(raw)
    if (!parsed.success) {
      const extra = parsed.error.issues.find((i) => i.code === 'unrecognized_keys')
      return apiError(
        'invalid_request',
        extra && 'keys' in extra
          ? `Unknown field: ${(extra.keys as string[]).join(', ')}. Send only url and events.`
          : 'url must be a string of up to 2,000 characters and events a list of 1 to 10 event names.',
      )
    }
    try {
      const { webhook, secret } = await createWebhook(db(), key, parsed.data)
      return json({ ...webhook, secret }, 201)
    } catch (err) {
      if (err instanceof WebhookError) return apiError('invalid_request', err.message)
      throw err
    }
  })
