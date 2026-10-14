'use client'

import { formatDollars } from '@mde/money/dollars'
import { Button } from '@mde/ui'
import { useRef, useState } from 'react'
import { Notice } from '../_components/ui'
import { demoFinishAction, demoSearchAction, demoStartAction, demoStatusAction, demoYoutubeAction } from './actions'

type Platform = 'tiktok' | 'instagram' | 'x'
const NAMES: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', x: 'X', youtube: 'YouTube' }
const n = (v: number) => v.toLocaleString('en-US')

/**
 * Builds the demo campaign step by step: start, each searched platform page by page until its share of
 * the budget or the credit limit is reached, then YouTube clips from the file, then close it.
 */
export function DemoBuilder({
  slug,
  title,
  exists,
  queries,
  pages,
  creditCap,
  youtubeClips,
}: {
  slug: string
  title: string
  exists: boolean
  queries: string[]
  pages: Partial<Record<Platform, number>>
  creditCap: number
  youtubeClips: number
}) {
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [credits, setCredits] = useState(0)
  const [left, setLeft] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [spent, setSpent] = useState<{ earned: number; budget: number; posts: number } | null>(null)
  const stop = useRef(false)
  const say = (line: string) => setLog((l) => [...l.slice(-14), line])

  const refresh = async () => {
    const s = await demoStatusAction(slug)
    if (s) setSpent({ earned: s.earnedCents, budget: s.budgetCents, posts: s.posts })
    return s
  }

  const run = async (replace: boolean) => {
    setRunning(true)
    setError(null)
    setDone(null)
    stop.current = false
    let used = 0
    let noKey = false
    const resume = new Map<string, string>()
    try {
      const start = await demoStartAction(slug, replace)
      if ('error' in start) throw new Error(start.error)
      say('Campaign ready.')
      for (const platform of ['tiktok', 'instagram', 'x'] as Platform[]) {
        const maxPages = pages[platform] ?? 0
        if (!maxPages || noKey) continue
        let addedHere = 0
        for (const q of queries) {
          if (noKey) break
          let cursor: string | null = null
          for (let p = 0; p < maxPages; p++) {
            if (stop.current) throw new Error('Stopped.')
            if (used >= creditCap) break
            const r = await demoSearchAction(slug, platform, q, cursor)
            if ('error' in r) throw new Error(r.error)
            if (r.skipped) {
              say('No data provider key on this service: TikTok, Instagram and X are skipped.')
              noKey = true
              break
            }
            used += r.credits
            setCredits(used)
            if (r.creditsRemaining !== null) setLeft(r.creditsRemaining)
            addedHere += r.added
            say(`${NAMES[platform]} "${q}": ${r.added} clips added (${addedHere} so far).`)
            cursor = r.next
            if (!cursor) break
          }
          if (cursor) resume.set(`${platform}:${q}`, cursor)
          const s = await refresh()
          if (used >= creditCap) {
            say(`Credit limit of ${n(creditCap)} reached.`)
            break
          }
          if (s && s.budgetCents - s.earnedCents < 100) break
        }
      }
      let offset = 0
      for (;;) {
        if (stop.current) throw new Error('Stopped.')
        const r = await demoYoutubeAction(slug, offset)
        if ('error' in r) throw new Error(r.error)
        offset += 80
        say(`YouTube: ${r.added} clips added.`)
        await refresh()
        if (r.done) break
      }
      // Top-up: what the budget has left goes to more TikTok and Instagram clips, any size, from where
      // each search stopped, until the budget or the credit limit is reached.
      for (const platform of ['tiktok', 'instagram'] as Platform[]) {
        if (noKey) break
        for (const q of queries) {
          let cursor = resume.get(`${platform}:${q}`) ?? null
          if (!cursor) continue
          for (let p = 0; p < 3 && cursor; p++) {
            if (stop.current) throw new Error('Stopped.')
            const s = await refresh()
            if (!s || s.budgetCents - s.earnedCents < 2_000 || used >= creditCap) break
            const r = await demoSearchAction(slug, platform, q, cursor, true)
            if ('error' in r) throw new Error(r.error)
            used += r.credits
            setCredits(used)
            if (r.creditsRemaining !== null) setLeft(r.creditsRemaining)
            say(`Top-up ${NAMES[platform]} "${q}": ${r.added} clips added.`)
            cursor = r.next
          }
        }
      }
      const fin = await demoFinishAction(slug)
      if ('error' in fin) throw new Error(fin.error)
      const s = fin.status
      setDone(
        s
          ? `${title} is ready: ${n(s.posts)} clips, ${n(s.views)} views, ${formatDollars(s.earnedCents)} of ${formatDollars(s.budgetCents)} spent. ${Object.entries(
              s.byPlatform,
            )
              .map(([p, v]) => `${NAMES[p] ?? p} ${n(v.posts)}`)
              .join(', ')}.`
          : 'Done.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-muted-2">
        Searches TikTok, Instagram and X through the data provider, spending at most {n(creditCap)} credits (about{' '}
        {formatDollars(Math.ceil(creditCap * 0.188))} at $1.88 per 1,000), then fills the rest with up to{' '}
        {n(youtubeClips)} free YouTube clips. It takes a few minutes; keep this page open.
      </p>
      <div className="flex flex-wrap gap-3">
        {exists ? (
          <Button type="button" size="sm" loading={running} onClick={() => run(true)}>
            Rebuild {title}
          </Button>
        ) : (
          <Button type="button" size="sm" loading={running} onClick={() => run(false)}>
            Build {title}
          </Button>
        )}
        {running ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => (stop.current = true)}>
            Stop
          </Button>
        ) : null}
      </div>
      {spent ? (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-ink transition-[width] duration-500"
              style={{ width: `${Math.min(100, (spent.earned / Math.max(1, spent.budget)) * 100)}%` }}
            />
          </div>
          <p className="mt-2 mb-0 text-muted-2">
            {n(spent.posts)} clips, {formatDollars(spent.earned)} of {formatDollars(spent.budget)} spent. Credits used{' '}
            {n(credits)}
            {left !== null ? `, ${n(left)} left on the account` : ''}.
          </p>
        </div>
      ) : null}
      {log.length ? (
        <ul className="m-0 max-h-[220px] list-none overflow-auto rounded-[10px] bg-[rgba(0,0,0,0.04)] p-3 font-mono text-[12px]">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
      {done ? <Notice kind="ok">{done}</Notice> : null}
      {error ? <Notice kind="bad">{error}</Notice> : null}
    </div>
  )
}
