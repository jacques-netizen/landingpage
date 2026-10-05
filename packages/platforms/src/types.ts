import type { tables } from '@mde/db'

export type Platform = (typeof tables.PLATFORMS)[number]
export type LinkMethod = (typeof tables.LINK_METHODS)[number]

export type ProfileData = {
  platformUserId: string
  handle: string
  followers: number | null
  bio: string | null
  isPublic: boolean
  createdAt: Date | null
}

export type PostData = {
  exists: boolean
  isPublic: boolean
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  publishedAt: Date | null
  durationSeconds: number | null
  caption: string | null
  authorPlatformUserId: string | null
  /** A thumbnail or frame link the duplicate media check can hash, where the platform gives one. */
  thumbnailUrl?: string | null
  /** A perceptual hash the provider computed itself, where it can (the mock scripts this). */
  mediaHash?: string | null
  rawRef: unknown
  /** Which provider answered. The router fills this in. */
  source?: string
}

// All platform data goes through this interface so providers can be swapped (03_SYSTEMS.md 3.1).
export interface ViewProvider {
  name: string
  supports(platform: Platform, linkMethod: LinkMethod): boolean
  fetchProfile(input: {
    platform: Platform
    handle?: string
    platformUserId?: string
    token?: string
  }): Promise<ProfileData | null>
  fetchPost(input: { platform: Platform; postUrl: string; platformPostId?: string; token?: string }): Promise<PostData>
}

/** The provider could not answer (timeout, outage, rate limit). Never a judgement about the account or post. */
export class ProviderUnavailable extends Error {
  constructor(
    message: string,
    readonly provider: string,
  ) {
    super(message)
    this.name = 'ProviderUnavailable'
  }
}
