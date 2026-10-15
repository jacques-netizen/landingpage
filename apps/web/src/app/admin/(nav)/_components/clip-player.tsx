'use client'

import { useEffect, useRef, useState } from 'react'

// A clip playing inside the staff admin (owner brief, 2026-10-15). The post's picture fills a 9:16
// frame; a click plays the video file itself through the app's media route, with sound. A post with no
// file plays in the platform's own player: TikTok's embed by video id, Instagram's by shortcode (post or
// reel), YouTube's and X's by id. Nothing from a platform loads until the clip is opened. A clip whose
// file and picture have both stopped loading is called unavailable, with the link to the post as the
// fallback.

export type Clip = {
  id: string
  platform: string
  platformPostId: string
  postUrl: string
  handle: string
  hasVideo: boolean
  hasThumbnail: boolean
}

const PLATFORM: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' }
/** The platforms' players at the size they are designed for; the frame scales them to fit. */
const PLAYER_W = 325
const PLAYER_H = 578

export const clipMedia = (id: string, kind: 'video' | 'image') => `/api/admin/media/${id}?kind=${kind}`

/** The platform's player address, with tracking left off (only the post id goes in). */
export function embedUrl(c: Pick<Clip, 'platform' | 'platformPostId' | 'postUrl'>, play: boolean) {
  switch (c.platform) {
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${c.platformPostId}`
    case 'instagram': {
      const reel = /instagram\.com\/(?:[^/?#]+\/)?reels?\//i.test(c.postUrl)
      return `https://www.instagram.com/${reel ? 'reel' : 'p'}/${c.platformPostId}/embed/`
    }
    case 'youtube':
      return `https://www.youtube.com/embed/${c.platformPostId}?playsinline=1${play ? '&autoplay=1' : ''}`
    case 'x':
      return `https://platform.twitter.com/embed/Tweet.html?id=${c.platformPostId}&theme=dark&dnt=true`
    default:
      return c.postUrl
  }
}

/** Only one clip plays at a time. */
function pauseOthers(except: HTMLVideoElement | null) {
  for (const v of Array.from(document.querySelectorAll('video'))) if (v !== except && !v.paused) v.pause()
}

export function UnavailableBadge() {
  return (
    <span className="inline-flex items-center rounded-[6px] border border-solid border-[rgba(229,103,92,0.6)] bg-[rgba(229,103,92,0.14)] px-2 py-[2px] text-[11px] font-semibold text-[#F08A80]">
      Post unavailable
    </span>
  )
}

export function ClipPlayer({
  clip: c,
  open = false,
  radius = 12,
  onUnavailable,
}: {
  clip: Clip
  /** Load the player at once (the card is open) instead of waiting for a click. */
  open?: boolean
  radius?: number
  onUnavailable?: (id: string) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [mode, setMode] = useState<'poster' | 'video' | 'embed' | 'unavailable'>(
    open && c.hasVideo ? 'video' : 'poster',
  )
  const [scale, setScale] = useState(0)
  const [posterBroken, setPosterBroken] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setMode(open && c.hasVideo ? 'video' : 'poster')
    setPosterBroken(false)
    setPlaying(false)
  }, [c.id, c.hasVideo, open])

  useEffect(() => {
    if (mode !== 'embed' || !frame.current) return
    const el = frame.current
    const fit = () => setScale(el.clientWidth / PLAYER_W)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mode])

  const told = useRef(false)
  useEffect(() => {
    if (mode === 'unavailable' && !told.current) {
      told.current = true
      onUnavailable?.(c.id)
    }
  }, [c.id, mode, onUnavailable])

  const unavailable = () => setMode('unavailable')
  const activate = () => {
    if (mode === 'video') {
      const v = video.current
      if (!v) return
      if (v.paused) {
        pauseOthers(v)
        v.play().catch(unavailable)
      } else v.pause()
    } else if (mode === 'poster') {
      if (c.hasVideo) {
        setMode('video')
        // Play once the element exists.
        setTimeout(() => {
          const v = video.current
          if (v) {
            pauseOthers(v)
            v.play().catch(() => undefined)
          }
        }, 0)
      } else if (posterBroken && c.hasThumbnail) unavailable()
      else setMode('embed')
    }
  }

  return (
    <div
      ref={frame}
      className="relative w-full overflow-hidden bg-[#0B0A08] outline-none focus-visible:ring-2 focus-visible:ring-gold-soft"
      style={{ aspectRatio: '9 / 16', borderRadius: radius }}
    >
      {mode === 'video' ? (
        <video
          ref={video}
          src={clipMedia(c.id, 'video')}
          poster={c.hasThumbnail ? clipMedia(c.id, 'image') : undefined}
          playsInline
          controls
          preload="metadata"
          onPlay={() => {
            pauseOthers(video.current)
            setPlaying(true)
          }}
          onPause={() => setPlaying(false)}
          onError={() => (c.hasThumbnail && !posterBroken ? setMode('embed') : unavailable())}
          className="absolute inset-0 size-full object-cover"
        />
      ) : mode === 'embed' && scale > 0 ? (
        <iframe
          title={`${c.handle} on ${PLATFORM[c.platform] ?? c.platform}`}
          src={embedUrl(c, true)}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute top-0 left-0 border-0 bg-[#0B0A08]"
          style={{ width: PLAYER_W, height: PLAYER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      ) : mode === 'unavailable' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <UnavailableBadge />
          <p className="m-0 text-[13px] text-muted-2">Can't load this clip: the post may be private or deleted.</p>
          <a href={c.postUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-gold-soft">
            Open on {PLATFORM[c.platform] ?? c.platform} ↗
          </a>
          <button
            type="button"
            onClick={() => setMode('embed')}
            className="cursor-pointer rounded-pill border border-solid border-line bg-transparent px-3 py-1 text-[12px] text-muted-2"
          >
            Try the platform player
          </button>
        </div>
      ) : null}

      {mode === 'poster' ? (
        <button
          type="button"
          aria-label={`Play ${c.handle}'s clip`}
          onClick={activate}
          className="group absolute inset-0 m-0 cursor-pointer border-0 bg-transparent p-0"
        >
          {c.hasThumbnail && !posterBroken ? (
            <img
              src={clipMedia(c.id, 'image')}
              alt=""
              onError={() => setPosterBroken(true)}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="absolute inset-x-0 top-4 text-center text-[12px] text-muted">
              {PLATFORM[c.platform] ?? c.platform}
            </span>
          )}
          <span
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg, rgba(11,10,8,0) 55%, rgba(11,10,8,0.5) 100%)' }}
          >
            <span className="flex size-[52px] items-center justify-center rounded-full border border-solid border-[rgba(255,255,255,0.35)] bg-[rgba(11,10,8,0.55)] backdrop-blur-[6px] transition-transform duration-300 group-hover:scale-110">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      ) : null}
      {mode === 'video' && !playing ? (
        <button
          type="button"
          aria-label={`Play ${c.handle}'s clip`}
          onClick={activate}
          className="absolute inset-x-0 top-0 bottom-12 m-0 flex cursor-pointer items-center justify-center border-0 bg-transparent p-0"
        >
          <span className="flex size-[52px] items-center justify-center rounded-full border border-solid border-[rgba(255,255,255,0.35)] bg-[rgba(11,10,8,0.55)] backdrop-blur-[6px]">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      ) : null}
    </div>
  )
}
