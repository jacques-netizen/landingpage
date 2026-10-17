'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { askVerificationAction, staffVerifyAction } from './verification-actions'

// Staff set a post's views from analytics the clipper sent them outside the app (owner request,
// 2026-10-16), or ask the clipper to verify the views themselves. Only on approved posts.

const APPROVED = ['approved', 'earning']
/** A typed count, or null when the box was left empty (the last figures read are kept). */
const num = (v: string) => (v.replace(/[^0-9]/g, '') ? Number(v.replace(/[^0-9]/g, '')) : null)
const field = 'h-9 w-full rounded-[8px] border border-solid border-line bg-field-2 px-2 font-app text-[13px] text-ink'

export function SetViews({
  campaignId,
  id,
  state,
  views,
}: {
  campaignId: string
  id: string
  state: string
  views: number
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | 'set' | 'ask'>(null)
  const [count, setCount] = useState('')
  const [likes, setLikes] = useState('')
  const [comments, setComments] = useState('')
  const [shares, setShares] = useState('')
  const [note, setNote] = useState('')
  const [fileId, setFileId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, start] = useTransition()
  if (!APPROVED.includes(state)) return null

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/uploads', {
        method: 'POST',
        body: file,
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-file-name': encodeURIComponent(file.name),
        },
      })
      const j = (await res.json()) as { id?: string; error?: { message: string } }
      if (!res.ok || !j.id) throw new Error(j.error?.message ?? 'The upload failed. Try again.')
      setFileId(j.id)
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'The upload failed. Try again.' })
    } finally {
      setUploading(false)
    }
  }
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn()
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
      if (r.ok) {
        setPanel(null)
        setCount('')
        setLikes('')
        setComments('')
        setShares('')
        setNote('')
        setFileId(null)
        router.refresh()
      }
    })

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPanel(panel === 'set' ? null : 'set')}
          className="h-7 cursor-pointer rounded-pill border border-solid border-[rgba(216,197,143,0.35)] bg-[rgba(216,197,143,0.1)] px-3 font-app text-[11px] font-medium text-gold-soft"
        >
          Set views from analytics
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === 'ask' ? null : 'ask')}
          className="h-7 cursor-pointer rounded-pill border border-solid border-line bg-transparent px-3 font-app text-[11px] text-muted-2"
        >
          Ask clipper to verify
        </button>
      </div>
      {panel === 'set' ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-solid border-line bg-field p-3">
          <p className="m-0 text-[11px] text-muted-2">
            The counts the clipper's analytics show. Likes, comments and shares left empty keep the last ones read. It
            stands as the post's views until the scraper passes it (now {views.toLocaleString('en-US')}).
          </p>
          <input
            aria-label="Views in the analytics"
            inputMode="numeric"
            placeholder="Views in the analytics"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={field}
          />
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Likes', likes, setLikes],
                ['Comments', comments, setComments],
                ['Shares', shares, setShares],
              ] as const
            ).map(([label, value, set]) => (
              <input
                key={label}
                aria-label={label}
                inputMode="numeric"
                placeholder={label}
                value={value}
                onChange={(e) => set(e.target.value)}
                className={field}
              />
            ))}
          </div>
          <label className="text-[11px] text-muted-2">
            Screenshot of the analytics (optional)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => upload(e.target.files?.[0])}
              className="mt-1 block w-full text-[11px]"
            />
          </label>
          <input
            aria-label="Note"
            placeholder="Note (the clipper sees it)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={field}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || uploading}
              onClick={() =>
                run(() =>
                  staffVerifyAction(campaignId, id, Number(count.replace(/[^0-9]/g, '')), fileId, note, {
                    likes: num(likes),
                    comments: num(comments),
                    shares: num(shares),
                  }),
                )
              }
              className="h-8 cursor-pointer rounded-[8px] border-0 bg-gold-soft px-3 font-app text-[12px] font-semibold text-[#1A1510] disabled:opacity-60"
            >
              {uploading ? 'Uploading' : 'Set views'}
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 font-app text-[12px] text-muted-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : panel === 'ask' ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-solid border-line bg-field p-3">
          <p className="m-0 text-[11px] text-muted-2">
            The clipper gets a notification with the link to the Verify views form.
          </p>
          <input
            aria-label="Message to the clipper"
            placeholder="Message (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={field}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => askVerificationAction(campaignId, id, note))}
              className="h-8 cursor-pointer rounded-[8px] border-0 bg-gold-soft px-3 font-app text-[12px] font-semibold text-[#1A1510] disabled:opacity-60"
            >
              Send request
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 font-app text-[12px] text-muted-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={`m-0 text-[11px] ${message.ok ? 'text-[#4FB286]' : 'text-[#F08A80]'}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
