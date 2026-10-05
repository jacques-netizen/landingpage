import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeHandle, parsePostUrl } from './urls'
import type { Platform, PostData, ProfileData, ViewProvider } from './types'

type ScriptedProfile = Partial<Omit<ProfileData, 'createdAt'>> & { createdAt?: string | Date | null }
type ScriptedPost = Partial<Omit<PostData, 'publishedAt'>> & { publishedAt?: string | Date | null }

export type MockState = {
  /** Keyed "platform:handle", e.g. "tiktok:maya". */
  profiles?: Record<string, ScriptedProfile>
  /** Keyed "platform:postId". */
  posts?: Record<string, ScriptedPost>
  /** Make every call fail, to test outages. */
  down?: boolean
}

export const MOCK_STATE_FILE = process.env.MOCK_PROVIDER_FILE ?? path.join(os.tmpdir(), 'mde-mock-provider.json')

/** Script the mock from another process (end to end tests). Merges into what is already there. */
export function writeMockState(update: MockState, file = MOCK_STATE_FILE) {
  const cur = readMockState(file)
  const next: MockState = {
    profiles: { ...cur.profiles, ...update.profiles },
    posts: { ...cur.posts, ...update.posts },
    down: update.down ?? cur.down,
  }
  fs.writeFileSync(file, JSON.stringify(next))
}

export function readMockState(file = MOCK_STATE_FILE): MockState {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as MockState
  } catch {
    return {}
  }
}

const mockUserId = (platform: Platform, handle: string) => `mock-${platform}-${normalizeHandle(handle)}`
const date = (v: string | Date | null | undefined) => (v == null ? null : new Date(v))

// Scripted data for development and tests (03_SYSTEMS.md 3.1). Anything not scripted gets a plain
// public profile with an empty bio, and a post that does not exist.
export class MockProvider implements ViewProvider {
  name = 'mock'
  constructor(private source: () => MockState = () => readMockState()) {}

  supports() {
    return true
  }

  async fetchProfile({ platform, handle }: { platform: Platform; handle?: string }): Promise<ProfileData | null> {
    const s = this.source()
    if (s.down) throw new Error('mock provider is down')
    if (!handle) return null
    const h = normalizeHandle(handle)
    const p = s.profiles?.[`${platform}:${h}`]
    if (p === undefined)
      return {
        platformUserId: mockUserId(platform, h),
        handle: h,
        followers: 1000,
        bio: '',
        isPublic: true,
        createdAt: null,
      }
    return {
      platformUserId: p.platformUserId ?? mockUserId(platform, h),
      handle: p.handle ?? h,
      followers: p.followers ?? 1000,
      bio: p.bio ?? '',
      isPublic: p.isPublic ?? true,
      createdAt: date(p.createdAt),
    }
  }

  async fetchPost({
    platform,
    postUrl,
    platformPostId,
  }: {
    platform: Platform
    postUrl: string
    platformPostId?: string
  }) {
    const s = this.source()
    if (s.down) throw new Error('mock provider is down')
    const parsed = parsePostUrl(postUrl)
    const id = platformPostId ?? parsed?.platformPostId
    const p = id ? s.posts?.[`${platform}:${id}`] : undefined
    const none: PostData = {
      exists: false,
      isPublic: false,
      views: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      publishedAt: null,
      durationSeconds: null,
      caption: null,
      authorPlatformUserId: null,
      rawRef: { mock: true, id },
    }
    if (!p) return none
    return {
      ...none,
      exists: true,
      isPublic: true,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      ...p,
      publishedAt: date(p.publishedAt),
      rawRef: { mock: true, id },
    } satisfies PostData
  }
}
