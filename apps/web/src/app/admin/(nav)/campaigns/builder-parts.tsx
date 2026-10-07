'use client'

import { Button, Field, Input, Select } from '@mde/ui'
import { useRef, useState, type ReactNode } from 'react'
import { quickClientAction } from './actions'

// Pieces of the campaign builder (staff screen, not in the mockups; staff style).

/** Uploads one file to the staff upload route and returns its public path. */
export async function uploadFile(file: File): Promise<{ url: string; name: string }> {
  const res = await fetch('/api/admin/uploads', {
    method: 'POST',
    body: file,
    headers: { 'x-file-name': encodeURIComponent(file.name), 'content-type': file.type || 'application/octet-stream' },
  })
  const body = (await res.json().catch(() => null)) as {
    url?: string
    name?: string
    error?: { message: string }
  } | null
  if (!res.ok || !body?.url) throw new Error(body?.error?.message ?? 'The upload failed. Try again.')
  return { url: body.url, name: body.name ?? file.name }
}

/** A dollar amount: type 2000, 2k or 2,000. */
export function MoneyField({
  name,
  label,
  helper,
  error,
  defaultValue,
  placeholder,
  readOnly,
}: {
  name: string
  label: string
  helper?: string
  error?: string
  defaultValue?: string
  placeholder?: string
  readOnly?: boolean
}) {
  return (
    <Field label={label} helper={helper} error={error}>
      {(p) => (
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-muted-2"
          >
            $
          </span>
          <Input
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            name={name}
            defaultValue={defaultValue?.replace(/^\$/, '').replace(/\.00$/, '')}
            placeholder={placeholder}
            inputMode="decimal"
            autoComplete="off"
            readOnly={readOnly}
            className="pl-8"
          />
        </div>
      )}
    </Field>
  )
}

function DropZone({
  accept,
  multiple,
  onFiles,
  busy,
  children,
}: {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  busy: boolean
  children: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-card border border-dashed px-6 py-8 text-center text-[14px] ${
        over ? 'border-ink bg-field-2' : 'border-sand bg-field'
      }`}
    >
      {children}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading' : multiple ? 'Choose files' : 'Choose a file'}
      </Button>
      <span className="text-[13px] text-muted-2">or drop {multiple ? 'them' : 'it'} here</span>
    </div>
  )
}

/** The campaign card picture: upload a photo, see it, replace or remove it. */
export function CoverUpload({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const [url, setUrl] = useState(defaultValue)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const onFiles = async (files: File[]) => {
    const f = files[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return setProblem('Choose a picture (JPG, PNG or WebP).')
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
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">Campaign picture</span>
      <input type="hidden" name="coverImageUrl" value={url} />
      {url ? (
        <div className="flex items-end gap-4">
          <img
            src={url}
            alt="Campaign picture"
            className="h-[180px] w-[140px] rounded-card border border-solid border-line object-cover"
          />
          <div className="flex gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-pill border border-solid border-sand bg-field px-5 text-[13px] font-medium">
              Replace
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFiles([...(e.target.files ?? [])])}
              />
            </label>
            <Button type="button" variant="quiet" size="sm" onClick={() => setUrl('')}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <DropZone accept="image/*" onFiles={onFiles} busy={busy}>
          <span>Upload the picture shown on the campaign card.</span>
        </DropZone>
      )}
      {problem || error ? <p className="m-0 text-[13px] text-bad">{problem ?? error}</p> : null}
    </div>
  )
}

type Asset = { label: string; url: string }

function parseAssets(text: string): Asset[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [label = '', url = ''] = l.split('|').map((x) => x.trim())
      return { label, url }
    })
}

/** Files and links creators may use: upload files or add links, each with a name. */
export function AssetsEditor({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const [items, setItems] = useState<Asset[]>(() => parseAssets(defaultValue))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const set = (i: number, patch: Partial<Asset>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const onFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    setProblem(null)
    try {
      for (const f of files) {
        const up = await uploadFile(f)
        setItems((xs) => [...xs, { label: f.name.replace(/\.[^.]+$/, ''), url: up.url }])
      }
    } catch (e) {
      setProblem((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const serialized = items
    .filter((a) => a.url.trim())
    .map((a) => `${(a.label.trim() || 'File').replace(/\|/g, '/')} | ${a.url.trim()}`)
    .join('\n')
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium">Assets for creators</span>
      <span className="-mt-2 text-[13px] text-muted-2">Footage, logos, sounds or links creators can use.</span>
      <textarea name="assets" value={serialized} readOnly hidden />
      {items.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((a, i) => (
            <li key={i} className="grid grid-cols-[1fr_2fr_auto] items-center gap-2">
              <Input
                aria-label="Name"
                value={a.label}
                placeholder="Name"
                onChange={(e) => set(i, { label: e.target.value })}
                className="h-10 text-[14px]"
              />
              {a.url.startsWith('/files/') ? (
                <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-[14px]">
                  Uploaded file: {decodeURIComponent(a.url.split('/').pop() ?? '')}
                </a>
              ) : (
                <Input
                  aria-label="Link"
                  value={a.url}
                  placeholder="https://"
                  onChange={(e) => set(i, { url: e.target.value })}
                  className="h-10 text-[14px]"
                />
              )}
              <Button
                type="button"
                variant="quiet"
                size="sm"
                onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <DropZone multiple onFiles={onFiles} busy={busy}>
        <span>Upload files for creators.</span>
      </DropZone>
      <div>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => setItems((xs) => [...xs, { label: '', url: '' }])}
        >
          + Add a link instead
        </Button>
      </div>
      {problem || error ? <p className="m-0 text-[13px] text-bad">{problem ?? error}</p> : null}
    </div>
  )
}

/** Choose the client, or add a new one without leaving the builder. */
export function ClientPicker({
  clients: initial,
  defaultValue,
  error,
  disabled,
}: {
  clients: { id: string; name: string }[]
  defaultValue: string
  error?: string
  disabled?: boolean
}) {
  const [clients, setClients] = useState(initial)
  const [value, setValue] = useState(defaultValue)
  const [adding, setAdding] = useState(initial.length === 0)
  const [name, setName] = useState('')
  const [fee, setFee] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const add = async () => {
    setBusy(true)
    setProblem(null)
    const r = await quickClientAction({ name, feePercent: fee })
    setBusy(false)
    if (r.error || !r.client) return setProblem(r.error ?? 'Could not add the client.')
    setClients((cs) => [...cs, r.client!].sort((a, b) => a.name.localeCompare(b.name)))
    setValue(r.client.id)
    setAdding(false)
    setName('')
    setFee('')
  }
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="clientId" value={value} />
      {adding ? (
        <div className="flex flex-col gap-3 rounded-card border border-solid border-line bg-field p-4">
          <span className="text-[13px] font-medium">New client</span>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Input
              aria-label="Client name"
              placeholder="Client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="relative">
              <Input
                aria-label="Service fee percent"
                placeholder="Fee"
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="pr-9"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-2">%</span>
            </div>
          </div>
          <span className="text-[12px] text-muted-2">
            The fee is charged on top of the budget. Leave it empty for none.
          </span>
          {problem ? <p className="m-0 text-[13px] text-bad">{problem}</p> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" loading={busy} onClick={add}>
              Add client
            </Button>
            {clients.length ? (
              <Button type="button" variant="quiet" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Field label="Client" error={error} helper={disabled ? 'Fixed once the campaign is live.' : undefined}>
          {(p) => (
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <Select
                  id={p.id}
                  aria-describedby={p.describedBy}
                  invalid={p.invalid}
                  value={value || undefined}
                  onValueChange={setValue}
                  placeholder="Choose a client"
                  disabled={disabled}
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              {disabled ? null : (
                <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
                  + New client
                </Button>
              )}
            </div>
          )}
        </Field>
      )}
      {adding && error ? <p className="m-0 text-[13px] text-bad">{error}</p> : null}
    </div>
  )
}
