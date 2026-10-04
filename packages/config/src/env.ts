import { z } from 'zod'

const optional = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined))

// Only DATABASE_URL, REDIS_URL and AUTH_SECRET are required. Everything else is optional so the
// app starts in development with the mock provider and the mock payout adapter (04_BUILD_PLAN.md section 3).
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_GOOGLE_ID: optional,
  AUTH_GOOGLE_SECRET: optional,
  AUTH_DISCORD_ID: optional,
  AUTH_DISCORD_SECRET: optional,
  TOKEN_ENCRYPTION_KEY: optional,
  STORAGE_ENDPOINT: optional,
  STORAGE_BUCKET: optional,
  STORAGE_ACCESS_KEY_ID: optional,
  STORAGE_SECRET_ACCESS_KEY: optional,
  EMAIL_API_KEY: optional,
  EMAIL_FROM: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  PAYPAL_CLIENT_ID: optional,
  PAYPAL_CLIENT_SECRET: optional,
  YOUTUBE_API_KEY: optional,
  META_APP_ID: optional,
  META_APP_SECRET: optional,
  TIKTOK_CLIENT_KEY: optional,
  TIKTOK_CLIENT_SECRET: optional,
  DATA_PROVIDER_API_KEY: optional,
  SENTRY_DSN: optional,
  BRAND_NAME: z.string().default('BRAND_NAME'),
  LEGAL_ENTITY: z.string().default('LEGAL_ENTITY'),
  CONTACT_EMAIL: z.string().default('CONTACT_EMAIL'),
  SUPPORT_DISCORD_URL: optional,
  APP_URL: z.string().url().default('http://localhost:3000'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env)
    if (!parsed.success) {
      const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
      throw new Error(`Invalid environment variables: ${keys}`)
    }
    cached = parsed.data
  }
  return cached
}

export function brand() {
  const e = env()
  return {
    name: e.BRAND_NAME,
    legalEntity: e.LEGAL_ENTITY,
    contactEmail: e.CONTACT_EMAIL,
    supportDiscordUrl: e.SUPPORT_DISCORD_URL,
  }
}
