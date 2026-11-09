import { requireStaff } from '@/server/guard'
import { codeChanges, liveCommit, recentDeploys, STAFF_PAGE, staffActions } from '@/server/changes'
import { AdminPage } from '../_components/ui'

export const dynamic = 'force-dynamic'

// The Change log (owner, 2026-11-09: "track what changes are being made to the platform and where they
// came from"): code changes with who asked and who made them, every deploy that went live, and every
// staff action on live data. Admin only. Not in the mockups; staff style, like the Team page.

const REPO = 'https://github.com/jacques-netizen/landingpage/commit/'
const TABS = [
  ['code', 'Code changes'],
  ['deploys', 'Deploys'],
  ['staff', 'Staff actions'],
] as const
type Tab = (typeof TABS)[number][0]

const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
const th = 'py-2 pr-4 font-normal whitespace-nowrap'
const td = 'py-3 pr-4 align-top'

export default async function ChangesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireStaff('admin', '/admin/changes')
  const sp = await searchParams
  const tab: Tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : 'code'
  const page = Math.max(1, Number(sp.page) || 1)
  const live = liveCommit()

  return (
    <AdminPage
      title="Change log"
      lead="What changed on the platform and where it came from: code changes, deploys, and staff actions on live data."
    >
      <p className="m-0 mb-6 text-[13px] text-muted-2">
        Live now:{' '}
        {live ? (
          <a href={`${REPO}${live.sha}`} className="font-mono text-ink">
            {live.sha.slice(0, 7)}
          </a>
        ) : (
          'not reported (only set on Railway)'
        )}
        {live?.branch ? ` from ${live.branch}` : ''}
      </p>
      <nav aria-label="Change log" className="mb-6 flex gap-2">
        {TABS.map(([k, label]) => (
          <a
            key={k}
            href={`/admin/changes?tab=${k}`}
            aria-current={tab === k ? 'page' : undefined}
            className={`rounded-pill px-4 py-2 text-[13px] no-underline ${
              tab === k ? 'bg-ink text-white hover:text-white' : 'border border-solid border-line text-ink'
            }`}
          >
            {label}
          </a>
        ))}
      </nav>
      {tab === 'code' ? <Code /> : tab === 'deploys' ? <Deploys /> : <Staff page={page} />}
    </AdminPage>
  )
}

function Code() {
  const rows = codeChanges()
  if (!rows.length) return <p className="text-[14px] text-muted-2">No change log found.</p>
  return (
    <>
      <p className="m-0 mb-4 text-[13px] text-muted-2">
        From CHANGELOG.md in the repository, newest first. Made by names the Claude Code session or person that wrote
        the change; Requested by is who asked for it.
      </p>
      <table className="w-full border-collapse text-[14px]">
        <caption className="sr-only">Code changes</caption>
        <thead>
          <tr className="text-left text-[13px] text-muted-2">
            <th scope="col" className={th}>
              Date
            </th>
            <th scope="col" className={th}>
              Change
            </th>
            <th scope="col" className={th}>
              Requested by
            </th>
            <th scope="col" className={th}>
              Made by
            </th>
            <th scope="col" className={th}>
              Commit
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.commit} className="border-0 border-t border-solid border-line">
              <td className={`${td} whitespace-nowrap text-muted-2`}>{r.date}</td>
              <td className={td}>{r.what}</td>
              <td className={`${td} whitespace-nowrap`}>{r.requestedBy}</td>
              <td className={`${td} whitespace-nowrap`}>{r.madeBy}</td>
              <td className={td}>
                <a href={`${REPO}${r.commit}`} className="font-mono text-[13px]">
                  {r.commit}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

async function Deploys() {
  const rows = await recentDeploys()
  if (!rows.length)
    return <p className="text-[14px] text-muted-2">No deploys recorded yet. Each deploy is recorded from now on.</p>
  return (
    <table className="w-full border-collapse text-[14px]">
      <caption className="sr-only">Deploys</caption>
      <thead>
        <tr className="text-left text-[13px] text-muted-2">
          <th scope="col" className={th}>
            When (UTC)
          </th>
          <th scope="col" className={th}>
            Commit
          </th>
          <th scope="col" className={th}>
            Change
          </th>
          <th scope="col" className={th}>
            By
          </th>
          <th scope="col" className={th}>
            Branch
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-0 border-t border-solid border-line">
            <td className={`${td} whitespace-nowrap text-muted-2`}>{when.format(r.createdAt)}</td>
            <td className={td}>
              <a href={`${REPO}${r.commitSha}`} className="font-mono text-[13px]">
                {r.commitSha.slice(0, 7)}
              </a>
            </td>
            <td className={td}>{r.message ?? ''}</td>
            <td className={`${td} whitespace-nowrap`}>{r.author ?? ''}</td>
            <td className={`${td} whitespace-nowrap text-muted-2`}>{r.branch ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

async function Staff({ page }: { page: number }) {
  const { rows, more } = await staffActions(page)
  return (
    <>
      <table className="w-full border-collapse text-[14px]">
        <caption className="sr-only">Staff actions</caption>
        <thead>
          <tr className="text-left text-[13px] text-muted-2">
            <th scope="col" className={th}>
              When (UTC)
            </th>
            <th scope="col" className={th}>
              Who
            </th>
            <th scope="col" className={th}>
              Action
            </th>
            <th scope="col" className={th}>
              On
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-0 border-t border-solid border-line">
              <td className={`${td} whitespace-nowrap text-muted-2`}>{when.format(r.at)}</td>
              <td className={`${td} whitespace-nowrap`}>{r.actorId ? (r.who ?? 'Removed user') : 'Platform'}</td>
              <td className={`${td} font-mono text-[13px]`}>{r.action}</td>
              <td className={`${td} text-muted-2`}>
                {r.entity}
                {r.entityId ? ` ${r.entityId.slice(0, 8)}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 flex gap-4 text-[13px]">
        {page > 1 ? <a href={`/admin/changes?tab=staff&page=${page - 1}`}>Newer</a> : null}
        {more ? <a href={`/admin/changes?tab=staff&page=${page + 1}`}>Older</a> : null}
        <span className="text-muted-2">{STAFF_PAGE} a page</span>
      </div>
    </>
  )
}
