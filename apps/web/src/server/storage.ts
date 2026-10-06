import 'server-only'
import { env } from '@mde/config'
import { db, tables } from '@mde/db'
import { AwsClient } from 'aws4fetch'
import { eq } from 'drizzle-orm'

// Files staff upload: campaign covers and assets. Without a storage bucket they are kept in the
// database (up to DB_MAX_BYTES each); with STORAGE_* set they go to the S3-compatible bucket.
export const DB_MAX_BYTES = 25 * 1024 * 1024
export const BUCKET_MAX_BYTES = 2 * 1024 * 1024 * 1024

function bucket() {
  const e = env()
  if (!e.STORAGE_ENDPOINT || !e.STORAGE_BUCKET || !e.STORAGE_ACCESS_KEY_ID || !e.STORAGE_SECRET_ACCESS_KEY) return null
  const client = new AwsClient({
    accessKeyId: e.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: e.STORAGE_SECRET_ACCESS_KEY,
    service: 's3',
    region: e.STORAGE_REGION ?? 'auto',
  })
  const base = `${e.STORAGE_ENDPOINT.replace(/\/$/, '')}/${e.STORAGE_BUCKET}`
  return { client, url: (key: string) => `${base}/${key}` }
}

export const maxUploadBytes = () => (bucket() ? BUCKET_MAX_BYTES : DB_MAX_BYTES)

const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(-120) || 'file'

/** Store one upload and return the public path it is served from. */
export async function saveUpload(
  input: { name: string; contentType: string; size: number; body: ReadableStream<Uint8Array> },
  uploadedBy: string,
) {
  const name = safeName(input.name)
  const contentType = input.contentType || 'application/octet-stream'
  const b = bucket()
  if (b) {
    const key = `uploads/${crypto.randomUUID()}/${name}`
    const res = await b.client.fetch(b.url(key), {
      method: 'PUT',
      body: input.body,
      headers: {
        'content-type': contentType,
        'content-length': String(input.size),
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
      // Streams the request body through instead of buffering it.
      duplex: 'half',
    } as RequestInit)
    if (!res.ok) throw new Error(`Storage returned ${res.status}`)
    const [row] = await db()
      .insert(tables.files)
      .values({ name, contentType, sizeBytes: input.size, storage: 's3', storageKey: key, uploadedBy })
      .returning({ id: tables.files.id })
    return { id: row!.id, url: `/files/${row!.id}/${name}`, name }
  }
  const data = Buffer.from(await new Response(input.body).arrayBuffer())
  if (data.length > DB_MAX_BYTES) throw new UploadTooLarge()
  const [row] = await db()
    .insert(tables.files)
    .values({ name, contentType, sizeBytes: data.length, storage: 'db', data, uploadedBy })
    .returning({ id: tables.files.id })
  return { id: row!.id, url: `/files/${row!.id}/${name}`, name }
}

export class UploadTooLarge extends Error {}

/** A stored file as an HTTP response, passing a Range request through for video. */
export async function serveFile(id: string, range: string | null): Promise<Response | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [f] = await db().select().from(tables.files).where(eq(tables.files.id, id))
  if (!f) return null
  // Pictures, video, audio and PDFs show in the browser; anything else downloads. Nothing uploaded
  // can run script on this site (sandboxed, and SVG is downloaded rather than shown).
  const inline = /^(image\/(png|jpe?g|gif|webp|avif)|video\/|audio\/|application\/pdf$)/.test(f.contentType)
  const headers: Record<string, string> = {
    'content-type': inline ? f.contentType : 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${f.name}"`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'; img-src 'self'; media-src 'self'",
  }
  if (f.storage === 'db') {
    return new Response(new Uint8Array(f.data!), { headers: { ...headers, 'content-length': String(f.sizeBytes) } })
  }
  const b = bucket()
  if (!b || !f.storageKey) return null
  const res = await b.client.fetch(b.url(f.storageKey), { headers: range ? { range } : {} })
  if (!res.ok && res.status !== 206) return null
  for (const h of ['content-length', 'content-range', 'accept-ranges']) {
    const v = res.headers.get(h)
    if (v) headers[h] = v
  }
  return new Response(res.body, { status: res.status, headers })
}
