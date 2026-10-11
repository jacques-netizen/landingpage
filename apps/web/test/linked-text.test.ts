import { describe, expect, it } from 'vitest'
import { splitLinks } from '../src/lib/linked-text-split'

describe('links inside stored text', () => {
  it('turns web addresses into links and leaves the rest alone', () => {
    expect(splitLinks('Rules - https://docs.google.com/document/d/1AU?tab=t.0#h.1 and post.')).toEqual([
      { text: 'Rules - ' },
      {
        text: 'https://docs.google.com/document/d/1AU?tab=t.0#h.1',
        href: 'https://docs.google.com/document/d/1AU?tab=t.0#h.1',
      },
      { text: ' and post.' },
    ])
  })
  it('keeps the full stop after an address out of the link', () => {
    expect(splitLinks('See https://example.com/a.')).toEqual([
      { text: 'See ' },
      { text: 'https://example.com/a', href: 'https://example.com/a' },
      { text: '.' },
    ])
  })
  it('does not link anything that is not an http address', () => {
    expect(splitLinks('mailto:x@y.z and www.example.com and javascript:alert(1)')).toEqual([
      { text: 'mailto:x@y.z and www.example.com and javascript:alert(1)' },
    ])
  })
})
