import { db } from '@mde/db'
import { createWebhook, listWebhooks, toApi, WebhookError } from '@mde/partners'
import { apiError, json, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

export const GET = (req: Request) =>
  withKey(req, async (key) => json({ object: 'list', data: (await listWebhooks(db(), key)).map(toApi) }))

// The secret is in this answer only: it signs every delivery and is never shown again.
export const POST = (req: Request) =>
  withKey(req, async (key) => {
    let body: { url?: unknown; events?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return apiError('invalid_request', 'Send a JSON body with url and events.')
    }
    if (typeof body.url !== 'string' || !Array.isArray(body.events) || !body.events.every((e) => typeof e === 'string'))
      return apiError('invalid_request', 'url must be a string and events a list of event names.')
    try {
      const { webhook, secret } = await createWebhook(db(), key, { url: body.url, events: body.events as string[] })
      return json({ ...webhook, secret }, 201)
    } catch (err) {
      if (err instanceof WebhookError) return apiError('invalid_request', err.message)
      throw err
    }
  })
