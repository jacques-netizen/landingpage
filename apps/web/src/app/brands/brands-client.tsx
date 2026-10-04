'use client'

import { useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { brandsDataContent, CASE_STUDIES, MAX_STATS } from '@/designed/brands.data'
import { BrandsDesign } from '@/designed/brands'
import { brandsContent } from '@/designed/brands.content'
import { DesignedFrame } from '@/designed/frame'
import { makeCopy } from '@/designed/runtime'

// Plays or pauses the first video inside the clicked element, as the mockup does.
function toggleVideo(ev: MouseEvent<HTMLElement>) {
  const video = ev.currentTarget.querySelector('video')
  if (!video) return
  if (video.paused) void video.play()
  else video.pause()
}

const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

// The brand site, built from "Platform Mockups" (screen "For brands").
export function BrandsClient({ overrides, contactEmail }: { overrides: Record<string, string>; contactEmail: string }) {
  const router = useRouter()
  const copy = makeCopy({ ...brandsContent, ...brandsDataContent }, overrides)
  const [active, setActive] = useState<string>(CASE_STUDIES[0].slug)
  const [paused, setPaused] = useState<Record<string, boolean>>({})
  const [playing, setPlaying] = useState<Record<string, boolean>>({})
  const setPlay = (key: string, on: boolean) => () => setPlaying((s) => ({ ...s, [key]: on }))

  const bookCallHref = copy('link.book-call') || `mailto:${contactEmail}`

  const cs = CASE_STUDIES.find((c) => c.slug === active) ?? CASE_STUDIES[0]
  const p = `case.${cs.slug}`
  const video = copy(`video.${cs.slug}`)
  const poster = copy(`${p}.poster`)
  const result = copy(`${p}.result`)
  const stats = Array.from({ length: MAX_STATS }, (_, i) => ({
    l: copy(`${p}.stat${i + 1}.label`),
    v: copy(`${p}.stat${i + 1}.value`),
  })).filter((s) => s.l)

  const testimonial = copy('video.kojo-testimonial')

  const v = {
    authoring: false,
    goHome: () => router.push('/'),
    bookCall: () => {
      window.location.href = bookCallHref
    },
    toCaseStudies: scrollTo('case-studies'),
    toPricing: scrollTo('pricing'),
    csTabs: CASE_STUDIES.map((c) => {
      const on = c.slug === active
      return {
        label: copy(`case.${c.slug}.tab`),
        go: () => setActive(c.slug),
        bg: on ? '#1A1510' : 'rgba(255,255,255,0.55)',
        fg: on ? '#FFFFFF' : '#1A1510',
        bd: on ? '#1A1510' : '#D8CDB9',
      }
    }),
    csActive: [
      {
        title: copy(`${p}.title`),
        objective: copy(`${p}.objective`),
        strategy: copy(`${p}.strategy`),
        stats,
        note: '',
        hasResult: !!result,
        result,
        video,
        hasVideo: !!video,
        noVideo: !video,
        hasPoster: !!poster,
        noPoster: !poster,
        poster,
        paused: !!paused[cs.slug],
        toggle: toggleVideo,
        onPlay: () => setPaused((s) => ({ ...s, [cs.slug]: false })),
        onPause: () => setPaused((s) => ({ ...s, [cs.slug]: true })),
      },
    ],
    frames: [1, 2, 3, 4].map((i) => {
      const key = `frame-${i}`
      const src = copy(`video.${key}`)
      return {
        img: `/designed/story-${i}-s.png`,
        rot: [-2, 1.5, -1.5, 2][i - 1],
        dur: 5 + i,
        delay: -i,
        video: src,
        hasVideo: !!src,
        noVideo: !src,
        showPlay: !playing[key],
        toggle: toggleVideo,
        onPlay: setPlay(key, true),
        onPause: setPlay(key, false),
      }
    }),
    tm: {
      video: testimonial,
      hasVideo: !!testimonial,
      noVideo: !testimonial,
      showPlay: !playing['kojo-testimonial'],
      toggle: toggleVideo,
      onPlay: setPlay('kojo-testimonial', true),
      onPause: setPlay('kojo-testimonial', false),
    },
  }

  return (
    <DesignedFrame>
      <BrandsDesign v={v} copy={copy} />
    </DesignedFrame>
  )
}
