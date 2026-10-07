'use client'

import { Button } from '@mde/ui'
import { useRef, useState } from 'react'
import { uploadFile } from '../campaigns/builder-parts'

const DESIGN = '/designed/camp-hero.png'

// The picture behind the featured campaign. Empty means the design's own picture.
export function HeroPicture({ defaultValue }: { defaultValue: string }) {
  const [url, setUrl] = useState(defaultValue)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const pick = async (f: File | undefined) => {
    if (!f) return
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setProblem('Choose a PNG, JPG or WebP picture.')
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
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium">Picture</span>
      <input type="hidden" name="image" value={url} />
      <img
        src={url || DESIGN}
        alt="Featured campaign picture"
        className="block aspect-[970/370] w-full rounded-[14px] border border-solid border-line object-cover object-right"
      />
      <span className="text-[13px] text-muted-2">
        Wide picture, about 1940 by 740 pixels. The text sits on the left, so keep the subject on the right.
      </span>
      <div className="flex gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label="Choose the featured picture"
          onChange={(e) => {
            void pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
          {url ? 'Change picture' : 'Upload picture'}
        </Button>
        {url ? (
          <Button type="button" variant="quiet" size="sm" onClick={() => setUrl('')}>
            Use the design&apos;s picture
          </Button>
        ) : null}
      </div>
      {problem ? <p className="m-0 text-[13px] text-bad">{problem}</p> : null}
    </div>
  )
}
