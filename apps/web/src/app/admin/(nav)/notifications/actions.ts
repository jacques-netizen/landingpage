'use server'

import { db } from '@mde/db'
import { setPayoutChangeAlerts } from '@mde/notifications'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type AlertsState = { ok?: string; error?: string }

/** A finance or admin staff member turns payout method alerts on or off for themselves. */
export async function savePayoutAlertsAction(_p: AlertsState, form: FormData): Promise<AlertsState> {
  const viewer = await requireStaff('money', '/admin/notifications')
  const on = form.get('payoutChanges') === 'on'
  await setPayoutChangeAlerts(db(), viewer.id, on)
  revalidatePath('/admin/notifications')
  return { ok: on ? 'Saved. You will be told about payout method changes.' : 'Saved. Payout method alerts are off.' }
}
