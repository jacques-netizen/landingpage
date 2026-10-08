'use client'

import { Button, Input } from '@mde/ui'
import { useActionState, useState } from 'react'
import { Notice } from '../_components/ui'
import { payoutAction, type PayoutState } from './actions'

const STATUS: Record<string, string> = {
  requested: 'To verify',
  approved: 'Verified, to send',
  in_batch: 'To send',
  sent: 'To send',
  paid: 'Paid',
  failed: 'Returned',
  cancelled: 'Cancelled',
}

export function PayoutRow(p: {
  id: string
  status: string
  creator: string
  creatorId: string
  contact: string
  amount: string
  fee: string
  net: string
  coin: string
  address: string
  requested: string
  hash: string | null
  explorer: string | null
  reason: string | null
}) {
  const [state, action, pending] = useActionState<PayoutState, FormData>(payoutAction.bind(null, p.id), {})
  const [rejecting, setRejecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const open = ['requested', 'approved', 'in_batch', 'sent'].includes(p.status)
  return (
    <section
      aria-label={`Withdrawal by ${p.creator}`}
      className="rounded-[14px] border border-solid border-line bg-panel p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <a href={`/admin/creators/${p.creatorId}`} className="font-app text-[16px] font-semibold">
            {p.creator}
          </a>
          <div className="mt-1 text-[12px] text-muted-2">{p.contact}</div>
          <div className="mt-1 text-[12px] text-muted-2">
            Requested {new Date(p.requested).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
            {STATUS[p.status] ?? p.status}
          </div>
        </div>
        <div className="text-right">
          <div className="font-app text-[22px] font-bold tabular-nums">{p.net}</div>
          <div className="text-[12px] text-muted-2">
            to send · {p.amount} withdrawn, fee {p.fee}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[10px] border border-solid border-line bg-field px-4 py-3">
        <div className="text-[12px] text-muted-2">{p.coin}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <code className="text-[14px] break-all">{p.address}</code>
          {p.address ? (
            <button
              type="button"
              className="cursor-pointer rounded-pill border border-solid border-sand bg-transparent px-3 py-1 text-[12px] text-ink"
              onClick={() => {
                void navigator.clipboard.writeText(p.address)
                setCopied(true)
              }}
            >
              {copied ? 'Copied' : 'Copy address'}
            </button>
          ) : null}
        </div>
      </div>

      {p.status === 'paid' && p.hash ? (
        <p className="mt-3 mb-0 text-[13px] break-all">
          Transaction:{' '}
          {p.explorer ? (
            <a href={p.explorer} target="_blank" rel="noreferrer">
              {p.hash}
            </a>
          ) : (
            p.hash
          )}
        </p>
      ) : null}
      {p.status === 'failed' && p.reason ? <p className="mt-3 mb-0 text-[13px] text-bad">Reason: {p.reason}</p> : null}

      {state.ok ? (
        <div className="mt-4">
          <Notice kind="ok">{state.ok}</Notice>
        </div>
      ) : null}
      {state.error ? (
        <div className="mt-4">
          <Notice kind="bad">{state.error}</Notice>
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          {p.status === 'requested' ? (
            <form action={action} className="flex gap-3">
              <input type="hidden" name="action" value="approve" />
              <Button type="submit" size="sm" loading={pending}>
                Verify
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting((r) => !r)}>
                Reject
              </Button>
            </form>
          ) : (
            <form action={action} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="action" value="paid" />
              <Input
                name="hash"
                aria-label="Transaction hash"
                placeholder="Transaction hash after sending"
                className="h-10 min-w-[320px] flex-1 font-mono text-[13px]"
                autoComplete="off"
              />
              <Button type="submit" size="sm" loading={pending}>
                Mark paid
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting((r) => !r)}>
                Reject
              </Button>
            </form>
          )}
          {rejecting ? (
            <form action={action} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="action" value="reject" />
              <Input
                name="reason"
                aria-label="Reason for rejecting"
                placeholder="Reason the creator will see, like: the address is not a valid wallet"
                className="h-10 min-w-[320px] flex-1 text-[13px]"
              />
              <Button type="submit" size="sm" variant="destructive" loading={pending}>
                Reject and return to balance
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
