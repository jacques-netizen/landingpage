import { db, tables } from '@mde/db'
import { listNotifications, markAllRead } from '@mde/notifications'
import { EmptyState } from '@mde/ui'
import { eq } from 'drizzle-orm'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { AdminPage } from '../_components/ui'
import { PayoutAlertsForm } from './alerts-form'

export const dynamic = 'force-dynamic'

const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

// A staff member's own notifications: new appeals, deadlines, funding and campaign events. Opening the
// page marks them read. Not in the mockups; staff style.
export default async function StaffNotificationsPage() {
  const viewer = await requireStaff('staff', '/admin/notifications')
  const d = db()
  const rows = await listNotifications(d, viewer.id)
  await markAllRead(d, viewer.id)
  const money = hasAccess(viewer, 'money')
  const [prefs] = money
    ? await d
        .select({ payout: tables.users.notifyPayoutChanges, email: tables.users.notifyEmail })
        .from(tables.users)
        .where(eq(tables.users.id, viewer.id))
    : []
  return (
    <AdminPage title="Notifications" lead="New appeals, deadlines, funding, campaign events and payout method changes.">
      {money && prefs ? <PayoutAlertsForm on={prefs.payout} emailOn={prefs.email} /> : null}
      {rows.length === 0 ? (
        <EmptyState body="No notifications yet." />
      ) : (
        <ul className="m-0 list-none p-0 text-[14px]">
          {rows.map((n) => (
            <li key={n.id} className="border-0 border-t border-solid border-line py-3 first:border-t-0">
              <p className="m-0">
                {!n.readAt ? <span className="mr-2 font-medium text-ok-ink">New</span> : null}
                {n.link ? (
                  <a href={n.link} className="font-medium">
                    {n.title}
                  </a>
                ) : (
                  <span className="font-medium">{n.title}</span>
                )}{' '}
                <span className="text-[13px] text-muted-2">{when(n.createdAt)}</span>
              </p>
              {n.body ? <p className="mt-1 mb-0 text-muted-2">{n.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  )
}
