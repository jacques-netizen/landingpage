import { describe, expect, it } from 'vitest'
import { BIO_CODE_ALPHABET, bioHasCode, generateBioCode, isValidHandle, normalizeHandle, parsePostUrl } from '../src'

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
