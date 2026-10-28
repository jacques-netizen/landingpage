'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createKeyAction, revokeKeyAction } from './actions'

const field = 'h-9 w-full rounded-[8px] border border-solid border-line bg-field-2 px-3 font-app text-[13px] text-ink'
const gold =
  'h-9 cursor-pointer rounded-[8px] border-0 bg-gold-soft px-4 font-app text-[13px] font-semibold text-[#1A1510] disabled:opacity-60'

export function NewKeyForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [partner, setPartner] = useState('')
  const [mode, setMode] = useState<'live' | 'sandbox'>('sandbox')
  const [all, setAll] = useState(true)
  const [chosen, setChosen] = useState<string[]>([])
  const [made, setMade] = useState<{ key: string; partner: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, start] = useTransition()

  if (made)
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13px] text-ink">
          Key for {made.partner}. Copy it now and send it to them privately: it is not shown again.
        </p>
        <input
          aria-label="New API key"
          readOnly
          value={made.key}
          className={`${field} font-mono`}
          onFocus={(e) => e.target.select()}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className={gold}
            onClick={() => navigator.clipboard?.writeText(made.key).then(() => setCopied(true))}
          >
            {copied ? 'Copied' : 'Copy key'}
          </button>
          <button
            type="button"
            className="h-9 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-4 font-app text-[13px] text-muted-2"
            onClick={() => {
              setMade(null)
              setPartner('')
              setCopied(false)
            }}
          >
            Done
          </button>
        </div>
      </div>
    )

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await createKeyAction({ partner, mode, clientIds: all ? [] : chosen })
          if (!r.ok) return setError(r.error)
          setMade({ key: r.key, partner: r.partner })
          router.refresh()
        })
      }}
    >
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <label className="text-[12px] text-muted-2">
          Partner
          <input value={partner} onChange={(e) => setPartner(e.target.value)} className={`mt-1 ${field}`} required />
        </label>
        <label className="text-[12px] text-muted-2">
          Kind of key
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value === 'live' ? 'live' : 'sandbox')}
            className={`mt-1 ${field}`}
          >
            <option value="sandbox">Sandbox: demo campaigns only, for building and testing</option>
            <option value="live">Live: real campaigns</option>
          </select>
        </label>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-[12px] text-muted-2">Campaigns it can see</legend>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="radio" checked={all} onChange={() => setAll(true)} /> Every campaign
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="radio" checked={!all} onChange={() => setAll(false)} /> Only these clients&apos; campaigns
        </label>
        {!all ? (
          <div className="mt-2 grid grid-cols-3 gap-1 max-md:grid-cols-1">
            {clients.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={chosen.includes(c.id)}
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, c.id] : chosen.filter((x) => x !== c.id))}
                />
                {c.name}
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>
      {error ? (
        <p role="alert" className="m-0 text-[12px] text-[#F08A80]">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" className={gold} disabled={busy || (!all && chosen.length === 0)}>
          Create key
        </button>
      </div>
    </form>
  )
}

export function RevokeKey({ id, partner }: { id: string; partner: string }) {
  const router = useRouter()
  const [busy, start] = useTransition()
  return (
    <button
      type="button"
      disabled={busy}
      className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#F08A80] disabled:opacity-50"
      onClick={() =>
        confirm(`Revoke ${partner}'s key? Their requests and webhooks stop at once.`) &&
        start(async () => {
          await revokeKeyAction(id)
          router.refresh()
        })
      }
    >
      Revoke
    </button>
  )
}
