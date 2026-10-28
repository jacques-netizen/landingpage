import { json, withKey } from '@/server/partner-api'

export const dynamic = 'force-dynamic'

// The key in use: which partner it belongs to, live or sandbox, and what it can see.
export const GET = (req: Request) =>
  withKey(req, async (key) =>
    json({
      object: 'api_key',
      id: key.id,
      partner: key.partner,
      livemode: key.mode === 'live',
      prefix: key.prefix,
      client_ids: key.clientIds,
      created_at: key.createdAt.toISOString(),
    }),
  )
