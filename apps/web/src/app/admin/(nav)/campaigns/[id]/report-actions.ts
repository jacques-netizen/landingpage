'use server'

import { revalidatePath } from 'next/cache'
import type { RuleProblem } from '@/reports/rules'
import type { ReportSpec } from '@/reports/spec'
import { requireStaff } from '@/server/guard'
import {
  createReport,
  deleteReport,
  getReport,
  instructReport,
  publishReport,
  restoreVersion,
  setLayout,
  undoReport,
  unlockReport,
} from '@/server/reports/service'

// Client reports (owner brief, 2026-10-26): finance and admins create, edit and publish them, like the
// client's report link. Publishing, unlocking and deleting are audited by the server module.

export type ReportActionResult =
  { ok: true; id?: string; message?: string } | { ok: false; error: string; problems?: RuleProblem[] }

async function staff(campaignId: string) {
  return requireStaff('money', `/admin/campaigns/${campaignId}?tab=reports`)
}

async function sameCampaign(campaignId: string, reportId: string) {
  const r = await getReport(reportId)
  return !!r && r.campaignId === campaignId
}

const done = (campaignId: string, reportId?: string) => {
  revalidatePath(`/admin/campaigns/${campaignId}`)
  if (reportId) revalidatePath(`/admin/campaigns/${campaignId}/reports/${reportId}`)
}

export async function createReportAction(
  campaignId: string,
  input: { kind: 'week' | 'final'; weekNumber: number | null; artist: string; preparedFor: string },
): Promise<ReportActionResult> {
  const viewer = await staff(campaignId)
  const r = await createReport({
    campaignId,
    kind: input.kind === 'final' ? 'final' : 'week',
    weekNumber: input.kind === 'final' ? null : Math.round(Number(input.weekNumber)) || null,
    artist: String(input.artist ?? '').slice(0, 80),
    preparedFor: String(input.preparedFor ?? '').slice(0, 80) || null,
    actorId: viewer.id,
  })
  if (!r.ok) return r
  done(campaignId)
  return { ok: true, id: r.id, message: r.warning }
}

type Action =
  | { do: 'instruct'; text: string }
  | { do: 'show'; show: ReportSpec['show'] }
  | { do: 'order'; order: string[] }
  | { do: 'undo' }
  | { do: 'restore'; versionId: string }
  | { do: 'publish' }
  | { do: 'unlock' }
  | { do: 'delete' }

export async function reportAction(campaignId: string, reportId: string, a: Action): Promise<ReportActionResult> {
  const viewer = await staff(campaignId)
  if (!(await sameCampaign(campaignId, reportId))) return { ok: false, error: 'That report is gone.' }
  const r =
    a.do === 'instruct'
      ? await instructReport(reportId, String(a.text ?? ''), viewer.id)
      : a.do === 'show'
        ? await setLayout(reportId, { show: a.show }, viewer.id)
        : a.do === 'order'
          ? await setLayout(reportId, { order: Array.isArray(a.order) ? a.order.map(String) : [] }, viewer.id)
          : a.do === 'undo'
            ? await undoReport(reportId)
            : a.do === 'restore'
              ? await restoreVersion(reportId, String(a.versionId), viewer.id)
              : a.do === 'publish'
                ? await publishReport(reportId, viewer.id)
                : a.do === 'unlock'
                  ? await unlockReport(reportId, viewer.id)
                  : await deleteReport(reportId, viewer.id)
  if (!r.ok) return r
  done(campaignId, reportId)
  return { ok: true }
}
