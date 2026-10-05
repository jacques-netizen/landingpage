// Perceptual hash for the duplicate media check (03_SYSTEMS.md section 4, check 11). A difference
// hash (dHash) of the thumbnail: shrink to 9x8 grey, compare each pixel with its right neighbour.
// Re-encoded or slightly cropped copies of the same clip land within a few bits of each other.
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'

type Image = { width: number; height: number; data: Uint8Array | Buffer }

export function decodeImage(buf: Buffer): Image | null {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) return PNG.sync.read(buf)
    if (buf[0] === 0xff && buf[1] === 0xd8) return jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 64 })
  } catch {
    return null
  }
  return null
}

/** 64-bit difference hash as 16 hex characters. */
export function dHash(img: Image): string {
  const W = 9
  const H = 8
  const grey: number[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Average the block of source pixels this cell covers.
      const x0 = Math.floor((x * img.width) / W)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / W))
      const y0 = Math.floor((y * img.height) / H)
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / H))
      let sum = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 4
          sum += 299 * img.data[i]! + 587 * img.data[i + 1]! + 114 * img.data[i + 2]!
          n++
        }
      grey.push(sum / n)
    }
  }
  let bits = ''
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W - 1; x++) bits += grey[y * W + x]! > grey[y * W + x + 1]! ? '1' : '0'
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

/** Fetch a thumbnail and hash it. Any failure means "not compared", never a rejection. */
export async function mediaHashFromUrl(url: string, http: typeof fetch = fetch): Promise<string | null> {
  if (!url.startsWith('https://')) return null
  try {
    const res = await http(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 5_000_000) return null
    const img = decodeImage(buf)
    return img ? dHash(img) : null
  } catch {
    return null
  }
}
