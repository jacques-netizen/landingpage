import type { ReactNode } from 'react'

// Building blocks of the staff campaign page, laid out like the Promote admin (owner request).
export function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[14px] border border-solid border-line bg-panel p-5">
      <h2 className="m-0 font-app text-[15px] font-semibold">{title}</h2>
      {note ? <p className="mt-1 mb-0 text-[12px] text-muted">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function RuleGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="m-0 text-[13px] font-semibold">{title}</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 max-md:grid-cols-1">{children}</div>
    </div>
  )
}

export function Rule({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-solid border-line bg-field px-4 py-3">
      <span
        aria-hidden
        className="flex size-7 flex-none items-center justify-center rounded-[8px] bg-field-2 text-[12px] text-gold-soft"
      >
        ✓
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-muted">{label}</span>
        <span className="block text-[14px] font-semibold">{children}</span>
      </span>
    </div>
  )
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={`px-3 py-2 text-[12px] font-medium text-muted ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

const DOT: Record<string, string> = { verified: '#4FB286', pending: '#E0A94A', failed: '#E5675C' }

export function Dot({ status }: { status: string }) {
  return (
    <span
      aria-label={status === 'verified' ? 'Verified' : status === 'pending' ? 'Pending' : 'Needs attention'}
      className="inline-block size-[8px] rounded-full"
      style={{ background: DOT[status] ?? '#E5675C' }}
    />
  )
}

const PLATFORM_SHORT: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' }

export function PlatformTag({ platform, small }: { platform: string; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-[6px] border border-solid border-line bg-field-2 font-medium text-muted-2 ${
        small ? 'px-[6px] py-0 text-[10px]' : 'px-2 py-[2px] text-[11px]'
      }`}
    >
      {PLATFORM_SHORT[platform] ?? platform}
    </span>
  )
}
