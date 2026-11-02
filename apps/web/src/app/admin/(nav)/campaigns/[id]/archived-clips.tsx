'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addArchivedClipAction } from './archived-actions'

// "Add clips that are no longer online" on the campaign's Clips tab (owner decision, 2026-11-02): staff
// upload the video files, say which page each was posted on, when, and the views it had. Each shows on
// the campaign and the client report; none is checked or paid. Staff style, like the CSV box above.

type Row = {
  key: string
  file: File
  poster: Blob | null
  posterUrl: string
  platform: string
  handle: string
  postedOn: string
  views: string
  likes: string
  comments: string
  shares: string
  status: 'ready' | 'adding' | 'added' | 'error'
  message: string
}

const PLATFORMS: [string, string][] = [
  ['tiktok', 'TikTok'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['x', 'X'],
]
const field =
  'box-border h-9 w-full min-w-0 rounded-[8px] border border-solid border-line bg-field-2 px-2 font-app text-[13px] text-ink'
const num = (v: string) => (v.replace(/[^0-9]/g, '') ? Number(v.replace(/[^0-9]/g, '')) : null)
const today = () => new Date().toISOString().slice(0, 10)

/** WhatsApp names videos "VIDEO-2026-07-05-10-55-53": the day it was sent, a good first guess. */
const dayFromName = (name: string) =>
  name
    .match(/(20\d{2})-(\d{2})-(\d{2})/)
    ?.slice(1, 4)
    .join('-') ?? today()

/** A picture from the video's first second, so the clip has a cover before it plays. */
function posterOf(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    const done = (b: Blob | null) => {
      URL.revokeObjectURL(url)
      resolve(b)
    }
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.onloadeddata = () => {
      v.currentTime = Math.min(1, (v.duration || 2) / 2)
    }
    v.onseeked = () => {
      const c = document.createElement('canvas')
      c.width = v.videoWidth
      c.height = v.videoHeight
      const ctx = c.getContext('2d')
      if (!ctx || !c.width) return done(null)
      ctx.drawImage(v, 0, 0)
      c.toBlob((b) => done(b), 'image/jpeg', 0.85)
    }
    v.onerror = () => done(null)
    setTimeout(() => done(null), 15_000)
    v.src = url
  })
}

async function upload(body: Blob, name: string, type: string) {
  const res = await fetch('/api/admin/uploads', {
    method: 'POST',
    body,
    headers: { 'content-type': type || 'application/octet-stream', 'x-file-name': encodeURIComponent(name) },
  })
  const j = (await res.json()) as { id?: string; error?: { message: string } }
  if (!res.ok || !j.id) throw new Error(j.error?.message ?? 'The upload failed. Try again.')
  return j.id
}

export function ArchivedClips({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const set = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const choose = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('video/') || /\.(mp4|mov)$/i.test(f.name))
    const added: Row[] = list.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      poster: null,
      posterUrl: '',
      platform: 'tiktok',
      handle: '',
      postedOn: dayFromName(file.name),
      views: '',
      likes: '',
      comments: '',
      shares: '',
      status: 'ready',
      message: '',
    }))
    setRows((rs) => [...rs.filter((r) => r.status !== 'added'), ...added])
    for (const r of added) {
      const poster = await posterOf(r.file)
      set(r.key, { poster, posterUrl: poster ? URL.createObjectURL(poster) : '' })
    }
  }

  const addAll = async () => {
    setBusy(true)
    for (const r of rows.filter((x) => x.status === 'ready' || x.status === 'error')) {
      if (!r.handle.trim()) {
        set(r.key, { status: 'error', message: 'Enter the page it was posted on.' })
        continue
      }
      set(r.key, { status: 'adding', message: 'Uploading' })
      try {
        const fileId = await upload(r.file, r.file.name, r.file.type || 'video/mp4')
        const thumbnailFileId = r.poster
          ? await upload(r.poster, r.file.name.replace(/\.\w+$/, '') + '.jpg', 'image/jpeg').catch(() => null)
          : null
        const res = await addArchivedClipAction(campaignId, {
          fileId,
          thumbnailFileId,
          platform: r.platform,
          handle: r.handle,
          postedOn: r.postedOn,
          views: num(r.views) ?? 0,
          likes: num(r.likes),
          comments: num(r.comments),
          shares: num(r.shares),
        })
        set(r.key, res.ok ? { status: 'added', message: 'Added.' } : { status: 'error', message: res.error })
      } catch (e) {
        set(r.key, { status: 'error', message: e instanceof Error ? e.message : 'The upload failed. Try again.' })
      }
    }
    setBusy(false)
    router.refresh()
  }

  const waiting = rows.filter((r) => r.status === 'ready' || r.status === 'error').length
  return (
    <section
      aria-label="Add clips that are no longer online"
      className="rounded-[14px] border border-solid border-line bg-panel p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 font-app text-[15px] font-semibold">Add clips that are no longer online</h2>
          <p className="mt-1 mb-0 text-[12px] text-muted">
            Upload the video files of posts that were taken down. Each shows on the campaign and the client report with
            the views you enter. They are never checked and never paid.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 font-app text-[12px] text-muted-2 hover:text-ink"
        >
          {open ? 'Close' : 'Upload videos'}
        </button>
      </div>
      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="file"
            aria-label="Video files"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            multiple
            onChange={(e) => {
              void choose(e.target.files)
              e.target.value = ''
            }}
            className="text-[12px]"
          />
          {rows.map((r) => (
            <div
              key={r.key}
              aria-label={r.file.name}
              className="grid grid-cols-[64px_1fr] gap-3 rounded-[10px] border border-solid border-line p-3"
            >
              <div className="h-[112px] w-[64px] overflow-hidden rounded-[8px] bg-field">
                {r.posterUrl ? <img src={r.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="flex flex-col gap-2">
                <div className="truncate text-[12px] text-muted">{r.file.name}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="flex flex-col gap-1 text-[11px] text-muted">
                    Platform
                    <select
                      value={r.platform}
                      disabled={r.status === 'added'}
                      onChange={(e) => set(r.key, { platform: e.target.value })}
                      className={field}
                    >
                      {PLATFORMS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-muted">
                    Page
                    <input
                      value={r.handle}
                      disabled={r.status === 'added'}
                      placeholder="@page"
                      onChange={(e) => set(r.key, { handle: e.target.value })}
                      className={field}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-muted">
                    Posted on
                    <input
                      type="date"
                      value={r.postedOn}
                      max={today()}
                      disabled={r.status === 'added'}
                      onChange={(e) => set(r.key, { postedOn: e.target.value })}
                      className={field}
                    />
                  </label>
                  {(
                    [
                      ['views', 'Views'],
                      ['likes', 'Likes'],
                      ['comments', 'Comments'],
                      ['shares', 'Shares'],
                    ] as const
                  ).map(([k, l]) => (
                    <label key={k} className="flex flex-col gap-1 text-[11px] text-muted">
                      {l}
                      <input
                        inputMode="numeric"
                        value={r[k]}
                        disabled={r.status === 'added'}
                        onChange={(e) => set(r.key, { [k]: e.target.value })}
                        className={field}
                      />
                    </label>
                  ))}
                </div>
                {r.message ? (
                  <p
                    role={r.status === 'error' ? 'alert' : 'status'}
                    className="m-0 text-[12px]"
                    style={{ color: r.status === 'error' ? '#F08A80' : r.status === 'added' ? '#4FB286' : undefined }}
                  >
                    {r.message}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          {waiting ? (
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void addAll()}
                className="h-9 cursor-pointer rounded-[8px] border-0 bg-gold-soft px-4 font-app text-[13px] font-semibold text-[#1A1510] disabled:opacity-60"
              >
                {busy ? 'Adding clips' : waiting === 1 ? 'Add 1 clip' : `Add ${waiting} clips`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
