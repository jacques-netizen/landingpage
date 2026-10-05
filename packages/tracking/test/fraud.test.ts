import { SETTINGS_DEFAULTS } from '@mde/config'
import { describe, expect, it } from 'vitest'
import { engagementBelowFloor, followerDrop, viewJump } from '../src/fraud'

const t = SETTINGS_DEFAULTS.fraud_thresholds
const at = (h: number) => new Date(Date.UTC(2026, 9, 1) + h * 3_600_000)
const series = (views: number[], every = 2) => views.map((v, i) => ({ takenAt: at(i * every), views: v }))

describe('view_jump', () => {
  it('stays quiet on steady growth', () =>
    expect(viewJump(series([0, 1000, 2100, 3000, 4200, 5100, 6000]), 50_000, t)).toBeNull())
  it('flags growth over 10 times the median of the last 5 intervals', () =>
    expect(viewJump(series([0, 1000, 2000, 3000, 4000, 5000, 16_001]), 50_000, t)).toEqual({
      gain: 11_001,
      median: 1000,
    }))
  it('does not judge the median rule until there are 5 earlier intervals', () =>
    expect(viewJump(series([0, 1000, 50_000]), 50_000, t)).toBeNull())
  it('flags over 100,000 views an hour on an account under 1,000 followers', () => {
    expect(viewJump(series([0, 300_000], 2), 900, t)).toEqual({ gain: 300_000, viewsPerHour: 150_000, followers: 900 })
    expect(viewJump(series([0, 300_000], 2), 5_000, t)).toBeNull()
  })
  it('ignores checks that could not see the views', () =>
    expect(
      viewJump(
        [
          { takenAt: at(0), views: 0 },
          { takenAt: at(2), views: null },
        ],
        100,
        t,
      ),
    ).toBeNull())
})

describe('engagement_below_floor', () => {
  it('waits until views pass 10,000', () =>
    expect(engagementBelowFloor({ views: 9_999, likes: 0, comments: 0, shares: 0 }, null, t)).toBeNull())
  it('uses 20 bps when the campaign sets no minimum', () => {
    expect(engagementBelowFloor({ views: 100_000, likes: 150, comments: 40, shares: 9 }, null, t)).toEqual({
      engaged: 199,
      views: 100_000,
      floorBps: 20,
    })
    expect(engagementBelowFloor({ views: 100_000, likes: 150, comments: 40, shares: 10 }, null, t)).toBeNull()
  })
  it('uses the campaign minimum when set', () =>
    expect(engagementBelowFloor({ views: 20_000, likes: 200, comments: 0, shares: 0 }, 150, t)?.floorBps).toBe(150))
  it('skips posts whose likes or comments are hidden', () =>
    expect(engagementBelowFloor({ views: 50_000, likes: null, comments: 0, shares: 0 }, null, t)).toBeNull())
})

describe('follower_drop', () => {
  it('flags losing more than half the followers', () => {
    expect(followerDrop(10_000, 4_999, t)).toEqual({ before: 10_000, after: 4_999 })
    expect(followerDrop(10_000, 5_000, t)).toBeNull()
  })
  it('ignores unknown counts', () => expect(followerDrop(null, 10, t)).toBeNull())
})
