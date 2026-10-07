'use client'

import { Button } from '@mde/ui'
import { useActionState, useRef, useState } from 'react'
import { uploadFile } from '../campaigns/builder-parts'
import { Notice } from '../_components/ui'
import { saveBrandSiteAction, type BrandSiteState } from './actions'

type Slot = { key: string; label: string; kind: 'video' | 'image' | 'link'; group: string }

function MediaSlot({ slot, initial }: { slot: Slot; initial: string }) {
  const [url, setUrl] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const upload = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith(slot.kind === 'video' ? 'video/' : 'image/'))
      return setProblem(slot.kind === 'video' ? 'Choose a video file (MP4 works everywhere).' : 'Choose a picture.')
    setBusy(true)
    setProblem(null)
    try {
      setUrl((await uploadFile(f)).url)
    } catch (e) {
      setProblem((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-card border border-solid border-line bg-field p-4">
      <span className="text-[13px] font-medium">{slot.label}</span>
      <input type="hidden" name={slot.key} value={url} />
      {slot.kind === 'link' ? (
        <input
          aria-label={slot.label}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendly.com/…"
          className="h-10 rounded-input border border-solid border-sand bg-white px-3 text-[14px]"
        />
      ) : (
        <>
          {url ? (
            slot.kind === 'video' ? (
              <video
                src={url}
                controls
                muted
                playsInline
                className="h-[220px] w-full rounded-input bg-black object-contain"
              />
            ) : (
              <img src={url} alt={slot.label} className="h-[220px] w-full rounded-input object-cover" />
            )
          ) : (
            <div className="flex h-[120px] items-center justify-center rounded-input border border-dashed border-sand text-[13px] text-muted-2">
              Nothing uploaded yet
            </div>
          )}
          <input
            ref={input}
            type="file"
            accept={slot.kind === 'video' ? 'video/*' : 'image/*'}
            className="hidden"
            aria-label={`Upload ${slot.label}`}
            onChange={(e) => {
              void upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
              {busy ? 'Uploading' : url ? 'Replace' : 'Upload'}
            </Button>
            {url ? (
              <Button type="button" variant="quiet" size="sm" onClick={() => setUrl('')}>
                Remove
              </Button>
            ) : null}
          </div>
          <input
            aria-label={`${slot.label} link`}
            value={url.startsWith('/files/') ? '' : url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="or paste a link to the file"
            className="h-9 rounded-input border border-solid border-sand bg-white px-3 text-[13px]"
          />
        </>
      )}
      {problem ? <p className="m-0 text-[13px] text-bad">{problem}</p> : null}
    </div>
  )
}

export function BrandSiteForm({ slots, values }: { slots: Slot[]; values: Record<string, string> }) {
  const [state, action, pending] = useActionState<BrandSiteState, FormData>(saveBrandSiteAction, {})
  const groups = [...new Set(slots.map((s) => s.group))]
  return (
    <form action={action} className="flex max-w-[960px] flex-col gap-10">
      {groups.map((g) => (
        <section key={g} aria-label={g}>
          <h2 className="m-0 mb-4 font-app text-[16px] font-semibold">{g}</h2>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {slots
              .filter((s) => s.group === g)
              .map((s) => (
                <MediaSlot key={s.key} slot={s} initial={values[s.key] ?? ''} />
              ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-0 flex items-center gap-4 border-0 border-t border-solid border-line bg-page py-5">
        <Button type="submit" loading={pending}>
          Save brand site
        </Button>
        {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
        {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      </div>
    </form>
  )
}
