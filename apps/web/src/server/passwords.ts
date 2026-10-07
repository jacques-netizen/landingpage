import crypto from 'node:crypto'
import { promisify } from 'node:util'

// Passwords are kept only as scrypt hashes: "scrypt$N$r$p$salt$hash", salt and hash in base64url.
const scrypt = promisify(crypto.scrypt) as (
  pw: string,
  salt: Buffer,
  len: number,
  opts: crypto.ScryptOptions,
) => Promise<Buffer>
const N = 16384
const R = 8
const P = 1
const LEN = 32

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 200

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const hash = await scrypt(password, salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$')
}

// Checked against when there is no account, so a wrong name takes as long as a wrong password.
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [kind, n, r, p, saltB64, hashB64] = (stored ?? DUMMY).split('$')
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64url')
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  })
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) && !!stored
}

/** Lowercase letters, digits, dot and underscore, 3 to 20 characters, starting with a letter or digit. */
export const USERNAME_RULE = /^[a-z0-9][a-z0-9._]{2,19}$/

export function normaliseUsername(raw: string) {
  return raw.trim().replace(/^@/, '').toLowerCase()
}
