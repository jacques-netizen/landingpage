import { STAFF_ROLES } from '@mde/config'
import { requireStaff } from '@/server/guard'
import { listTeam, ownerEmails, ROLE_LABEL } from '@/server/team'
import { AdminPage } from '../_components/ui'
import { AddMemberForm, RemoveRole } from './forms'

export const dynamic = 'force-dynamic'

// The team: add people by email with a role, or remove a role. Admin only, audited.
// Not in the mockups; staff style.
export default async function TeamPage() {
  const viewer = await requireStaff('admin', '/admin/team')
  const [team, owners] = [await listTeam(), ownerEmails()]
  return (
    <AdminPage title="Team" lead="Give your team access. They sign in at /staff/sign-in with the email you add here.">
      <section className="max-w-[860px] rounded-card border border-solid border-line bg-field p-6">
        <h2 className="m-0 mb-4 font-app text-[16px] font-semibold">Add someone</h2>
        <AddMemberForm roles={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r].name }))} />
        <ul className="mt-5 mb-0 flex list-none flex-col gap-1 p-0 text-[13px] text-muted-2">
          {STAFF_ROLES.map((r) => (
            <li key={r}>
              <span className="font-medium text-ink">{ROLE_LABEL[r].name}:</span> {ROLE_LABEL[r].can}
            </li>
          ))}
        </ul>
      </section>

      <table className="mt-10 w-full max-w-[860px] border-collapse text-[14px]">
        <caption className="sr-only">Team members</caption>
        <thead>
          <tr className="text-left text-[13px] text-muted-2">
            <th scope="col" className="py-2 font-normal">
              Person
            </th>
            <th scope="col" className="py-2 font-normal">
              Access
            </th>
          </tr>
        </thead>
        <tbody>
          {team.map((m) => (
            <tr key={m.id} className="border-0 border-t border-solid border-line align-top">
              <td className="py-3">
                <div className="font-medium">{m.name ?? m.email}</div>
                {m.name ? <div className="text-[13px] text-muted-2">{m.email}</div> : null}
                {m.id === viewer.id ? <div className="text-[13px] text-muted-2">You</div> : null}
              </td>
              <td className="py-3">
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {m.roles.map((r) => (
                    <li key={r} className="flex items-center gap-3">
                      <span>{ROLE_LABEL[r].name}</span>
                      {r === 'admin' && owners.includes(m.email.toLowerCase()) ? (
                        <span className="text-[13px] text-muted-2">Owner</span>
                      ) : m.id === viewer.id && r === 'admin' ? null : (
                        <RemoveRole userId={m.id} role={r} label={ROLE_LABEL[r].name} />
                      )}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminPage>
  )
}
