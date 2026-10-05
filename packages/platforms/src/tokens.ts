import crypto from 'node:crypto'

// OAuth tokens are encrypted at rest with AES-256-GCM; the key is a 32 byte secret given as base64
// in TOKEN_ENCRYPTION_KEY (03_SYSTEMS.md 2.2). Layout: 12 byte IV, 16 byte tag, ciphertext.
export type OAuthTokens = { accessToken: string; refreshToken: string | null; expiresAt: string | null }

function key(b64: string) {
  const k = Buffer.from(b64, 'base64')
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded')
  return k
}

export function encryptTokens(tokens: OAuthTokens, keyB64: string): Buffer {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(keyB64), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

export function decryptTokens(blob: Buffer, keyB64: string): OAuthTokens {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(keyB64), blob.subarray(0, 12))
  decipher.setAuthTag(blob.subarray(12, 28))
  const plain = Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8')
  return JSON.parse(plain) as OAuthTokens
}
