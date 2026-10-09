'use client'

import { useState, useTransition, type ReactNode } from 'react'
import {
  approvePostAction,
  deletePostAction,
  denyPostAction,
  pendingPostAction,
  type RowResult,
} from './submission-actions'

type Panel = null | 'deny' | 'note' | 'delete'

const APPROVED = ['approved', 'earning', 'final']
const DENIED = ['rejected', 'rejected_auto', 'removed']
const PENDING = ['checking', 'needs_review', 'needs_info', 'flagged', 'appealed']

// Solid, high-contrast buttons on the dark console (testing report, 2026-10-08: some looked dimmed).
// The one matching the post's current state is drawn as an outline and cannot be pressed.
const TONE = {
  approve: { bg: '#4FB286', ink: '#0E1A14' },
  pending: { bg: '#E0A94A', ink: '#1F1606' },
  deny: { bg: '#E5675C', ink: '#230B09' },
} as const

function ActionButton({
  tone,
  label,
  icon,
  current,
  busy,
  onClick,
}: {
  tone: keyof typeof TONE
  label: string
  icon: ReactNode
  current: boolean
  busy: boolean
  onClick: () => void
}) {
  const t = TONE[tone]
  return (
    <button
      type="button"
      title={current ? `Already ${label.toLowerCase()}` : label}
      aria-label={label}
      disabled={current || busy}
      onClick={onClick}
      className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-[8px] border-2 border-solid text-[15px] leading-none font-bold disabled:cursor-default"
      style={
        current
          ? { background: 'transparent', borderColor: t.bg, color: t.bg }
          : { background: t.bg, borderColor: t.bg, color: t.ink }
      }
    >
      <span aria-hidden>{icon}</span>
    </button>
  )
}

export function PostActions({
  campaignId,
  id,
  state,
  reasons,
  canDelete,
}: {
  campaignId: string
  id: string
  state: string
  reasons: { code: string; label: string }[]
  canDelete: boolean
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, start] = useTransition()
  const paidOut = state === 'paid_out'

  const go = (fn: () => Promise<RowResult>, onError?: (message: string) => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (r.ok) {
        setPanel(null)
        setNote('')
        setReason('')
      } else {
        setError(r.error)
        onError?.(r.error)
      }
    })

  const approveNow = () =>
    go(
      () => approvePostAction(campaignId, id, note),
      // Clearing open flags needs a note: ask for one in place.
      (m) => (m.startsWith('Add a note') ? setPanel('note') : undefined),
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-[6px]">
        {paidOut ? (
          <span className="text-[12px] text-muted">Paid out</span>
        ) : (
          <>
            <ActionButton
              tone="approve"
              label="Approve"
              icon="✓"
              current={APPROVED.includes(state)}
              busy={busy}
              onClick={approveNow}
            />
            <ActionButton
              tone="pending"
              label="Set to pending"
              icon={
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
                </svg>
              }
              current={PENDING.includes(state)}
              busy={busy}
              onClick={() => go(() => pendingPostAction(campaignId, id))}
            />
            <ActionButton
              tone="deny"
              label="Deny"
              icon="✕"
              current={DENIED.includes(state)}
              busy={busy}
              onClick={() => setPanel(panel === 'deny' ? null : 'deny')}
            />
            {canDelete ? (
              <button
                type="button"
                title="Delete"
                aria-label="Delete"
                disabled={busy}
                onClick={() => setPanel(panel === 'delete' ? null : 'delete')}
                className="ml-1 flex size-8 flex-none cursor-pointer items-center justify-center rounded-[8px] border border-solid border-[rgba(229,103,92,0.6)] bg-transparent text-[14px] text-[#F08A80]"
              >
                <svg
                  aria-hidden
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
          </>
        )}
      </div>

      {panel === 'deny' ? (
        <div className="flex w-[260px] flex-col gap-2 rounded-[10px] border border-solid border-line bg-field p-3">
          <label className="text-[12px] text-muted-2">
            Reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block h-9 w-full rounded-[8px] border border-solid border-line bg-field-2 px-2 text-[13px] text-ink"
            >
              <option value="">Choose a reason</option>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-muted-2">
            Note for the creator
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block h-9 w-full rounded-[8px] border border-solid border-line bg-field-2 px-2 text-[13px] text-ink"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => go(() => denyPostAction(campaignId, id, reason, note))}
              className="h-8 cursor-pointer rounded-[8px] border-0 px-3 text-[13px] font-semibold"
              style={{ background: TONE.deny.bg, color: TONE.deny.ink }}
            >
              Deny post
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 text-[13px] text-muted-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'note' ? (
        <div className="flex w-[260px] flex-col gap-2 rounded-[10px] border border-solid border-line bg-field p-3">
          <label className="text-[12px] text-muted-2">
            Note to clear the open flags
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block h-9 w-full rounded-[8px] border border-solid border-line bg-field-2 px-2 text-[13px] text-ink"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={approveNow}
              className="h-8 cursor-pointer rounded-[8px] border-0 px-3 text-[13px] font-semibold"
              style={{ background: TONE.approve.bg, color: TONE.approve.ink }}
            >
              Approve post
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 text-[13px] text-muted-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'delete' ? (
        <div className="flex w-[260px] flex-col gap-2 rounded-[10px] border border-solid border-line bg-field p-3">
          <p className="m-0 text-[12px] text-muted-2">
            Delete this post? Anything it earned goes back to the campaign budget. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => go(() => deletePostAction(campaignId, id))}
              className="h-8 cursor-pointer rounded-[8px] border-0 px-3 text-[13px] font-semibold"
              style={{ background: TONE.deny.bg, color: TONE.deny.ink }}
            >
              Delete post
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="h-8 cursor-pointer rounded-[8px] border border-solid border-line bg-transparent px-3 text-[13px] text-muted-2"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 max-w-[260px] text-[12px] text-[#F08A80]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
