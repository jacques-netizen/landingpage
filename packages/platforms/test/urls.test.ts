import { describe, expect, it } from 'vitest'
import {
  BIO_CODE_ALPHABET,
  bioHasCode,
  generateBioCode,
  isShortPostLink,
  isValidHandle,
  normalizeHandle,
  parsePostUrl,
  resolvePostUrl,
} from '../src'

describe('post links', () => {
  it.each([
    ['https://www.tiktok.com/@maya.clips/video/7350123456789012345', 'tiktok', '7350123456789012345', 'maya.clips'],
    ['https://tiktok.com/@Maya/video/7350123456789012345?is_from_webapp=1', 'tiktok', '7350123456789012345', 'maya'],
    ['https://www.instagram.com/reel/C5abcDEF123/', 'instagram', 'C5abcDEF123', null],
    ['https://instagram.com/p/C5abcDEF123', 'instagram', 'C5abcDEF123', null],
    ['https://www.instagram.com/maya/reel/C5abcDEF123/', 'instagram', 'C5abcDEF123', 'maya'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ', null],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=3', 'youtube', 'dQw4w9WgXcQ', null],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ', null],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ', null],
    ['https://x.com/maya/status/1790000000000000001', 'x', '1790000000000000001', 'maya'],
    ['https://twitter.com/Maya/status/1790000000000000001/photo/1', 'x', '1790000000000000001', 'maya'],
  ])('reads %s', (url, platform, id, handle) => {
    expect(parsePostUrl(url)).toEqual({ platform, platformPostId: id, handle })
  })

  it.each([
    'not a link',
    'ftp://tiktok.com/@a/video/123456789',
    'https://www.tiktok.com/@maya',
    'https://vm.tiktok.com/ZMabc123/',
    'https://www.instagram.com/maya/',
    'https://www.youtube.com/@maya',
    'https://youtube.com/watch?v=short',
    'https://x.com/maya',
    'https://example.com/video/123',
    'https://tiktok.com.evil.example/@a/video/7350123456789012345',
  ])('rejects %s', (url) => {
    expect(parsePostUrl(url)).toBeNull()
  })

  it('normalises and checks handles', () => {
    expect(normalizeHandle(' @Maya.Clips ')).toBe('maya.clips')
    expect(isValidHandle('x', '@maya_1')).toBe(true)
    expect(isValidHandle('x', 'maya.clips')).toBe(false)
    expect(isValidHandle('tiktok', 'a')).toBe(false)
    expect(isValidHandle('instagram', 'has space')).toBe(false)
  })
})

describe('bio codes', () => {
  it('uses the prefix and four characters with no look-alikes', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateBioCode('MDE')
      expect(code).toMatch(/^MDE-[A-Z0-9]{4}$/)
      for (const ch of code.slice(4)) expect(BIO_CODE_ALPHABET).toContain(ch)
    }
    for (const ch of '0O1IL5S2Z8B') expect(BIO_CODE_ALPHABET).not.toContain(ch)
  })

  it('finds the code in a bio regardless of case and spacing', () => {
    expect(bioHasCode('clips daily | mde-7k4q', 'MDE-7K4Q')).toBe(true)
    expect(bioHasCode('MDE - 7K4Q', 'MDE-7K4Q')).toBe(true)
    expect(bioHasCode('MDE-7K4R', 'MDE-7K4Q')).toBe(false)
    expect(bioHasCode(null, 'MDE-7K4Q')).toBe(false)
  })
})

// Share links from the apps (owner's clippers, 2026-10-10): the app only reads the full post link, so a
// short link is followed to it first.
describe('short share links', () => {
  const redirects: Record<string, string> = {
    'https://vm.tiktok.com/ZN8BSNUM/': 'https://www.tiktok.com/@ander_lyrics/video/7695181177023483158?_r=1',
    'https://vt.tiktok.com/ZSabc/': 'https://m.tiktok.com/v/7695181177023483158.html',
    'https://m.tiktok.com/v/7695181177023483158.html': 'https://www.tiktok.com/@ander_lyrics/video/7695181177023483158',
    'https://www.instagram.com/share/reel/_abc123/': 'https://www.instagram.com/reel/C5abcDEF123/',
    'https://vm.tiktok.com/loop/': 'https://vm.tiktok.com/loop/',
  }
  const http = (async (u: string | URL | Request, init?: RequestInit) => {
    const key = String(u)
    const to = redirects[key]
    if (init?.redirect !== 'manual') throw new Error('must not follow redirects automatically')
    return to ? new Response(null, { status: 302, headers: { location: to } }) : new Response('', { status: 200 })
  }) as typeof fetch

  it.each([
    ['https://vm.tiktok.com/ZN8BSNUM/', 'https://www.tiktok.com/@ander_lyrics/video/7695181177023483158?_r=1'],
    ['https://vt.tiktok.com/ZSabc/', 'https://www.tiktok.com/@ander_lyrics/video/7695181177023483158'],
    ['https://www.instagram.com/share/reel/_abc123/', 'https://www.instagram.com/reel/C5abcDEF123/'],
  ])('follows %s to the post', async (short, full) => {
    expect(await resolvePostUrl(short, http)).toBe(full)
  })

  it('leaves a full post link alone without any request', async () => {
    const full = 'https://www.tiktok.com/@maya.clips/video/7350123456789012345'
    const noHttp = (async () => {
      throw new Error('no request expected')
    }) as unknown as typeof fetch
    expect(await resolvePostUrl(full, noHttp)).toBe(full)
  })

  it('gives up on a loop or a link that goes nowhere', async () => {
    expect(await resolvePostUrl('https://vm.tiktok.com/loop/', http)).toBe('https://vm.tiktok.com/loop/')
    expect(await resolvePostUrl('https://vm.tiktok.com/nothing/', http)).toBe('https://vm.tiktok.com/nothing/')
  })

  it('is read as a short link only on the platforms own hosts', () => {
    expect(isShortPostLink('https://vm.tiktok.com/ZN8BSNUM/')).toBe(true)
    expect(isShortPostLink('https://www.tiktok.com/t/ZT8abc/')).toBe(true)
    expect(isShortPostLink('https://www.instagram.com/share/reel/_abc/')).toBe(true)
    expect(isShortPostLink('https://evil.example/vm.tiktok.com/ZN8/')).toBe(false)
    expect(isShortPostLink('https://www.tiktok.com/@maya/video/7350123456789012345')).toBe(false)
  })
})
