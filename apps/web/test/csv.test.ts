import { describe, expect, it } from 'vitest'
import { csvRecords, parseCsv } from '../src/lib/csv'

describe('csv', () => {
  it('reads quoted fields, doubled quotes, line breaks in quotes, CRLF and a byte order mark', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"two\nlines",z\n\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ])
  })
  it('takes semicolons, and keys rows by a lower-case header', () => {
    expect(csvRecords('URL;Clipper\nhttps://x.com/a/status/1;@kymen\n')).toEqual({
      header: ['url', 'clipper'],
      records: [{ url: 'https://x.com/a/status/1', clipper: '@kymen' }],
    })
    expect(csvRecords('Post URL,Status\nu,approved').header).toEqual(['post_url', 'status'])
  })
})
