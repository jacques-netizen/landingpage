import { env } from '@mde/config'
import { db } from '@mde/db'
import { accessTokenFor, buildProviderRouter, type LinkedAccount } from '@mde/platforms'
import { startWorker } from './worker'

const e = env()
const url = new URL(e.REDIS_URL)
const testing = process.env.NODE_ENV !== 'production' || process.env.MOCK_PROVIDER === '1'

const router = buildProviderRouter({
  youtubeApiKey: e.YOUTUBE_API_KEY,
  youtubeApiBase: (testing && process.env.YOUTUBE_API_URL_OVERRIDE) || undefined,
  dataProviderApiKey: e.DATA_PROVIDER_API_KEY,
  mock: testing,
})

// Accounts linked by YouTube login are read with the creator's own token, refreshed when needed.
const google =
  e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET && e.TOKEN_ENCRYPTION_KEY
    ? {
        client: {
          clientId: e.AUTH_GOOGLE_ID,
          clientSecret: e.AUTH_GOOGLE_SECRET,
          redirectUri: `${e.APP_URL}/api/oauth/youtube/callback`,
          tokenUrl: (testing && process.env.GOOGLE_TOKEN_URL_OVERRIDE) || undefined,
        },
        encryptionKey: e.TOKEN_ENCRYPTION_KEY,
      }
    : null
const tokenFor = async (account: LinkedAccount) =>
  google && account.platform === 'youtube' ? accessTokenFor(db(), account, google) : null

const running = await startWorker({
  connection: {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  },
  db: db(),
  router,
  tokenFor,
})
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }))

for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void running.close().then(() => process.exit(0))
  })
