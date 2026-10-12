import { describe, expect, it } from 'vitest'
import { readReportToken, reportKey, signReportToken, verifyReportToken } from '../src/lib/report-token'

const CAMPAIGN = '11111111-2222-4333-8444-555555555555'

describe('report links', () => {
  const key = reportKey('server-secret-at-least-16', 'campaign-secret-1')

  it('verifies a token it signed and reads the campaign from it', () => {
    const token = signReportToken({ c: CAMPAIGN, iat: 1_760_000_000 }, key)
    expect(token).not.toContain(CAMPAIGN)
    expect(readReportToken(token)).toEqual({ c: CAMPAIGN, iat: 1_760_000_000 })
    expect(verifyReportToken(token, key)).toEqual({ c: CAMPAIGN, iat: 1_760_000_000 })
  })

  it('refuses a token once the campaign secret has been rotated, or when it was tampered with', () => {
    const token = signReportToken({ c: CAMPAIGN, iat: 1 }, key)
    expect(verifyReportToken(token, reportKey('server-secret-at-least-16', 'campaign-secret-2'))).toBeNull()
    const [body, sig] = token.split('.')
    const other = Buffer.from(JSON.stringify({ c: '99999999-2222-4333-8444-555555555555', iat: 1 })).toString(
      'base64url',
    )
    expect(verifyReportToken(`${other}.${sig}`, key)).toBeNull()
    expect(verifyReportToken(`${body}.AAAA`, key)).toBeNull()
    expect(verifyReportToken('nonsense', key)).toBeNull()
  })

  it('honours an expiry', () => {
    const token = signReportToken({ c: CAMPAIGN, iat: 1, exp: 1_000 }, key)
    expect(verifyReportToken(token, key, 999_000)).not.toBeNull()
    expect(verifyReportToken(token, key, 1_000_000)).toBeNull()
  })
})
