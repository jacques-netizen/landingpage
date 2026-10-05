import crypto from 'node:crypto'

// No look-alike characters: no 0/O, 1/I/L, 5/S, 2/Z, 8/B (03_SYSTEMS.md 2.3).
export const BIO_CODE_ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY'

/** A code like MDE-7K4Q: the prefix from settings and four random characters. */
export function generateBioCode(prefix: string, pick: (max: number) => number = crypto.randomInt) {
  let s = ''
  for (let i = 0; i < 4; i++) s += BIO_CODE_ALPHABET[pick(BIO_CODE_ALPHABET.length)]
  return `${prefix}-${s}`
}

/** The bio contains the code, ignoring case and spaces around the dash. */
export function bioHasCode(bio: string | null, code: string) {
  if (!bio) return false
  const squash = (t: string) => t.toUpperCase().replace(/\s*-\s*/g, '-')
  return squash(bio).includes(squash(code))
}
