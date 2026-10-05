import { env } from '@mde/config'
import { db } from '@mde/db'
import { startWorker } from './worker'

const url = new URL(env().REDIS_URL)
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
})
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }))

for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void running.close().then(() => process.exit(0))
  })
