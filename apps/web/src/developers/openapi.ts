// The partner API's description in OpenAPI 3.1 (owner decision, 2026-10-28). Served at
// /api/v1/openapi.json and used to build the API reference at /developers/reference, so the reference
// never drifts from what the API answers. Keep it in step with apps/web/src/app/api/v1 and @mde/partners.

const id = '3f6c2a9e-8b1d-4c57-9a0e-2d4b7c1f5e88'
const campaignId = '9b2e4f10-6c3a-4d8e-b7f1-0a5c9e2d3b44'

export const EXAMPLES = {
  campaign: {
    id: campaignId,
    object: 'campaign',
    title: 'Summer single launch',
    status: 'live',
    platforms: ['tiktok', 'instagram'],
    cover_url: 'https://app.maisondelites.com/files/2d1c.../cover.jpg',
    client_id: '1c7e5a2b-0f4d-4b9a-8e36-5d2f1a7c9b03',
    starts_at: '2026-10-16T09:00:00.000Z',
    ends_at: null,
    ended_at: null,
    stats: {
      views: 91032,
      likes: 9812,
      comments: 107,
      shares: 173,
      engagement_rate: 11.1,
      clips_approved: 32,
      clips_in_review: 11,
      pages: 7,
      budget_delivered_percent: 9.1,
    },
    updated_at: '2026-10-26T10:00:00.000Z',
  },
  clip: {
    id,
    object: 'clip',
    campaign_id: campaignId,
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@examplepage/video/7697296279830940944',
    post_id: '7697296279830940944',
    page: { handle: 'examplepage', followers: 513100 },
    status: 'approved',
    posted_at: '2026-10-16T12:04:00.000Z',
    submitted_at: '2026-10-16T12:30:00.000Z',
    stats: { views: 17379, likes: 3434, comments: 41, shares: 40 },
    updated_at: '2026-10-26T09:12:00.000Z',
  },
  daily: {
    object: 'list',
    campaign_id: campaignId,
    data: [
      { date: '2026-10-16', views: 12480, views_total: 12480, clips_submitted: 9 },
      { date: '2026-10-17', views: 20311, views_total: 32791, clips_submitted: 6 },
    ],
  },
  report: {
    id: '5a0d3e7c-2b9f-4e61-8c14-7f3a6b2d9e05',
    object: 'report',
    kind: 'weekly',
    week: 1,
    url: 'https://app.maisondelites.com/reports/artist-week-1',
    pdf_url: 'https://app.maisondelites.com/reports/artist-week-1.pdf',
    published_at: '2026-10-26T15:00:00.000Z',
  },
  webhook: {
    id: '7e1b9c3d-4a2f-4d60-9b85-3c6e0f2a1d97',
    object: 'webhook',
    url: 'https://example.com/webhooks/maison',
    events: ['clip.approved', 'clip.views_updated'],
    created_at: '2026-10-28T10:00:00.000Z',
  },
  apiKey: {
    object: 'api_key',
    id: '2c8f0a6e-1d3b-4f97-a5e2-9b7c4d0e6f18',
    partner: 'Example Partner',
    livemode: false,
    prefix: 'mde_test_Ab3K',
    client_ids: null,
    created_at: '2026-10-28T09:00:00.000Z',
  },
  error: { error: { type: 'not_found', message: 'No campaign with that id for this key.' } },
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const list = (item: string, example: unknown) => ({
  type: 'object',
  required: ['object', 'data', 'has_more', 'next_cursor'],
  properties: {
    object: { const: 'list' },
    data: { type: 'array', items: ref(item) },
    has_more: { type: 'boolean', description: 'Whether another page follows.' },
    next_cursor: { type: ['string', 'null'], description: 'Pass as `cursor` to get the next page.' },
  },
  example: { object: 'list', data: [example], has_more: false, next_cursor: null },
})
const ok = (schema: object, example: unknown, description = 'OK') => ({
  description,
  content: { 'application/json': { schema, example } },
})
const errors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
  '429': { $ref: '#/components/responses/RateLimited' },
}
const notFound = { '404': { $ref: '#/components/responses/NotFound' } }
const idParam = (what: string) => ({
  name: 'id',
  in: 'path',
  required: true,
  description: `The ${what}'s id.`,
  schema: { type: 'string', format: 'uuid' },
})
const paging = [
  {
    name: 'limit',
    in: 'query',
    description: 'How many items to return, from 1 to 100.',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
  {
    name: 'cursor',
    in: 'query',
    description: 'The `next_cursor` from the previous page.',
    schema: { type: 'string' },
  },
]

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: "Maison d'Élites API",
    version: '2026-10-28',
    description:
      "Read campaign results from Maison d'Élites: campaigns, the clips posted for them with their views and engagement, views per day, and published client reports. Webhooks tell your system when clips are approved, views change and campaigns start or end.",
    contact: { name: "Maison d'Élites", url: 'https://maisondelites.com' },
  },
  servers: [{ url: 'https://app.maisondelites.com/api/v1', description: 'Live and sandbox (the key decides)' }],
  security: [{ bearer: [] }],
  tags: [
    { name: 'Campaigns', description: 'Campaigns that have gone live, with their totals.' },
    { name: 'Clips', description: 'The posts clippers made for a campaign, with their stats.' },
    { name: 'Reports', description: 'Published client reports.' },
    { name: 'Webhooks', description: 'Endpoints that receive events.' },
    { name: 'Account', description: 'The key in use.' },
  ],
  paths: {
    '/me': {
      get: {
        operationId: 'getMe',
        tags: ['Account'],
        summary: 'Get the current key',
        description: 'Which partner the key belongs to, whether it is live or sandbox, and which clients it covers.',
        responses: { '200': ok(ref('ApiKey'), EXAMPLES.apiKey), ...errors },
      },
    },
    '/campaigns': {
      get: {
        operationId: 'listCampaigns',
        tags: ['Campaigns'],
        summary: 'List campaigns',
        description:
          'Campaigns the key can see that have gone live, newest first. A sandbox key sees demo campaigns only.',
        parameters: [
          ...paging,
          {
            name: 'status',
            in: 'query',
            description: 'Only live or only ended campaigns.',
            schema: { type: 'string', enum: ['live', 'ended'] },
          },
        ],
        responses: {
          '200': ok(list('Campaign', EXAMPLES.campaign), list('Campaign', EXAMPLES.campaign).example),
          ...errors,
        },
      },
    },
    '/campaigns/{id}': {
      get: {
        operationId: 'getCampaign',
        tags: ['Campaigns'],
        summary: 'Get a campaign',
        description: "One campaign with its totals. Totals count approved clips only, from each clip's newest figures.",
        parameters: [idParam('campaign')],
        responses: { '200': ok(ref('Campaign'), EXAMPLES.campaign), ...errors, ...notFound },
      },
    },
    '/campaigns/{id}/daily': {
      get: {
        operationId: 'getCampaignDaily',
        tags: ['Campaigns'],
        summary: 'Get views per day',
        description:
          "Views gained each day (UTC) across the campaign's approved clips, the running total, and the clips submitted that day.",
        parameters: [idParam('campaign')],
        responses: { '200': ok(ref('DailyStats'), EXAMPLES.daily), ...errors, ...notFound },
      },
    },
    '/campaigns/{id}/clips': {
      get: {
        operationId: 'listClips',
        tags: ['Clips'],
        summary: "List a campaign's clips",
        description:
          'Approved clips and clips being checked, most recently submitted first. Rejected and removed clips are never listed.',
        parameters: [
          idParam('campaign'),
          ...paging,
          {
            name: 'status',
            in: 'query',
            description: 'Only approved clips, or only clips being checked.',
            schema: { type: 'string', enum: ['approved', 'in_review'] },
          },
        ],
        responses: {
          '200': ok(list('Clip', EXAMPLES.clip), list('Clip', EXAMPLES.clip).example),
          ...errors,
          ...notFound,
        },
      },
    },
    '/clips/{id}': {
      get: {
        operationId: 'getClip',
        tags: ['Clips'],
        summary: 'Get a clip',
        parameters: [idParam('clip')],
        responses: { '200': ok(ref('Clip'), EXAMPLES.clip), ...errors, ...notFound },
      },
    },
    '/campaigns/{id}/reports': {
      get: {
        operationId: 'listReports',
        tags: ['Reports'],
        summary: "List a campaign's reports",
        description:
          'Published client reports with their web and PDF addresses, newest first. Both open without a login.',
        parameters: [idParam('campaign')],
        responses: {
          '200': ok(
            {
              type: 'object',
              properties: { object: { const: 'list' }, data: { type: 'array', items: ref('Report') } },
            },
            { object: 'list', data: [EXAMPLES.report] },
          ),
          ...errors,
          ...notFound,
        },
      },
    },
    '/webhooks': {
      get: {
        operationId: 'listWebhooks',
        tags: ['Webhooks'],
        summary: 'List webhooks',
        responses: {
          '200': ok(
            {
              type: 'object',
              properties: { object: { const: 'list' }, data: { type: 'array', items: ref('Webhook') } },
            },
            { object: 'list', data: [EXAMPLES.webhook] },
          ),
          ...errors,
        },
      },
      post: {
        operationId: 'createWebhook',
        tags: ['Webhooks'],
        summary: 'Create a webhook',
        description:
          'Starts sending the chosen events to a public https address. The answer includes the signing secret, which is never shown again. A key can have up to 5 webhooks.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                  url: { type: 'string', format: 'uri', description: 'A public https address.' },
                  events: { type: 'array', items: ref('EventType') },
                },
              },
              example: { url: 'https://example.com/webhooks/maison', events: ['clip.approved', 'clip.views_updated'] },
            },
          },
        },
        responses: {
          '201': ok(
            { allOf: [ref('Webhook'), { type: 'object', properties: { secret: { type: 'string' } } }] },
            { ...EXAMPLES.webhook, secret: 'whsec_9fK2...' },
            'Created',
          ),
          '400': { $ref: '#/components/responses/InvalidRequest' },
          ...errors,
        },
      },
    },
    '/webhooks/{id}': {
      delete: {
        operationId: 'deleteWebhook',
        tags: ['Webhooks'],
        summary: 'Delete a webhook',
        description: 'Stops all deliveries to it, including retries still waiting.',
        parameters: [idParam('webhook')],
        responses: {
          '200': ok(
            {
              type: 'object',
              properties: { id: { type: 'string' }, object: { const: 'webhook' }, deleted: { const: true } },
            },
            { id: EXAMPLES.webhook.id, object: 'webhook', deleted: true },
          ),
          ...errors,
          ...notFound,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'Your API key: `mde_live_...` for live campaigns, `mde_test_...` for the sandbox.',
      },
    },
    responses: {
      Unauthorized: {
        description: 'The key is missing, wrong or revoked.',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: {
              error: { type: 'unauthorized', message: 'Send a valid API key as "Authorization: Bearer <key>".' },
            },
          },
        },
      },
      NotFound: {
        description: 'Nothing with that id that this key can see.',
        content: { 'application/json': { schema: ref('Error'), example: EXAMPLES.error } },
      },
      InvalidRequest: {
        description: 'A parameter or the body is not valid.',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: { error: { type: 'invalid_request', message: 'The url must start with https://.' } },
          },
        },
      },
      RateLimited: {
        description: 'Over 600 requests in a minute with this key. Wait for the `Retry-After` seconds.',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: {
              error: { type: 'rate_limited', message: 'Too many requests: the limit is 600 a minute per key.' },
            },
          },
        },
      },
    },
    schemas: {
      Campaign: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          object: { const: 'campaign' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['live', 'ended'] },
          platforms: { type: 'array', items: { type: 'string', enum: ['tiktok', 'instagram', 'youtube', 'x'] } },
          cover_url: { type: ['string', 'null'], description: "The campaign's picture." },
          client_id: { type: ['string', 'null'], format: 'uuid' },
          starts_at: { type: ['string', 'null'], format: 'date-time' },
          ends_at: { type: ['string', 'null'], format: 'date-time', description: 'The planned end, when set.' },
          ended_at: { type: ['string', 'null'], format: 'date-time' },
          stats: {
            type: 'object',
            properties: {
              views: { type: 'integer' },
              likes: { type: 'integer' },
              comments: { type: 'integer' },
              shares: { type: ['integer', 'null'], description: 'Null when no platform in the campaign gives shares.' },
              engagement_rate: {
                type: ['number', 'null'],
                description: 'Likes, comments and shares over views, in percent with one decimal.',
              },
              clips_approved: { type: 'integer' },
              clips_in_review: { type: 'integer' },
              pages: { type: 'integer', description: 'Accounts with an approved clip or one being checked.' },
              budget_delivered_percent: {
                type: ['number', 'null'],
                description: "The share of the campaign's budget delivered.",
              },
            },
          },
          updated_at: { type: ['string', 'null'], format: 'date-time', description: 'When figures were last read.' },
        },
      },
      Clip: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          object: { const: 'clip' },
          campaign_id: { type: 'string', format: 'uuid' },
          platform: { type: 'string', enum: ['tiktok', 'instagram', 'youtube', 'x'] },
          url: { type: 'string', description: 'The post on its platform.' },
          post_id: { type: 'string', description: "The platform's id for the post." },
          page: {
            type: 'object',
            properties: { handle: { type: ['string', 'null'] }, followers: { type: ['integer', 'null'] } },
          },
          status: { type: 'string', enum: ['approved', 'in_review'] },
          posted_at: { type: ['string', 'null'], format: 'date-time' },
          submitted_at: { type: 'string', format: 'date-time' },
          stats: {
            type: 'object',
            properties: {
              views: { type: 'integer' },
              likes: { type: 'integer' },
              comments: { type: 'integer' },
              shares: { type: ['integer', 'null'], description: 'Null on Instagram, which does not give shares.' },
            },
          },
          updated_at: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      DailyStats: {
        type: 'object',
        properties: {
          object: { const: 'list' },
          campaign_id: { type: 'string', format: 'uuid' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                views: { type: 'integer', description: 'Views gained that day.' },
                views_total: { type: 'integer', description: 'All views up to the end of that day.' },
                clips_submitted: { type: 'integer' },
              },
            },
          },
        },
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          object: { const: 'report' },
          kind: { type: 'string', enum: ['weekly', 'final'] },
          week: { type: ['integer', 'null'] },
          url: { type: 'string' },
          pdf_url: { type: 'string' },
          published_at: { type: 'string', format: 'date-time' },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          object: { const: 'webhook' },
          url: { type: 'string' },
          events: { type: 'array', items: ref('EventType') },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      EventType: {
        type: 'string',
        enum: ['campaign.started', 'campaign.ended', 'clip.approved', 'clip.views_updated'],
      },
      ApiKey: {
        type: 'object',
        properties: {
          object: { const: 'api_key' },
          id: { type: 'string', format: 'uuid' },
          partner: { type: 'string' },
          livemode: { type: 'boolean' },
          prefix: { type: 'string' },
          client_ids: { type: ['array', 'null'], items: { type: 'string', format: 'uuid' } },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['unauthorized', 'not_found', 'invalid_request', 'rate_limited', 'server_error'],
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const

export type Operation = {
  id: string
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  tag: string
  summary: string
  description?: string
  parameters: { name: string; in: string; required?: boolean; description: string; schema: Record<string, unknown> }[]
  body?: { example: unknown; schema: Record<string, unknown> }
  responses: { status: string; description: string; example: unknown }[]
}

type Json = Record<string, unknown>
const resolveResponse = (r: Json): Json => {
  const $ref = r.$ref as string | undefined
  return $ref ? ((OPENAPI.components.responses as unknown as Json)[$ref.split('/').pop()!] as Json) : r
}

/** Every operation, in the order of the reference. */
export function operations(): Operation[] {
  const out: Operation[] = []
  for (const [path, methods] of Object.entries(OPENAPI.paths as unknown as Record<string, Record<string, Json>>)) {
    for (const [method, op] of Object.entries(methods)) {
      const content = (op.requestBody as Json | undefined)?.content as Json | undefined
      const body = content?.['application/json'] as Json | undefined
      out.push({
        id: op.operationId as string,
        method: method.toUpperCase() as Operation['method'],
        path,
        tag: (op.tags as string[])[0]!,
        summary: op.summary as string,
        description: op.description as string | undefined,
        parameters: (op.parameters as Operation['parameters'] | undefined) ?? [],
        body: body ? { example: body.example, schema: body.schema as Json } : undefined,
        responses: Object.entries(op.responses as Record<string, Json>).map(([status, r]) => {
          const res = resolveResponse(r)
          const c = (res.content as Json | undefined)?.['application/json'] as Json | undefined
          return { status, description: res.description as string, example: c?.example }
        }),
      })
    }
  }
  return out
}
