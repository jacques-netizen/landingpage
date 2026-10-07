'use server'

import { db } from '@mde/db'
import { approve, reject, ReviewError } from '@mde/review'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'
import type { ReviewResult } from './review-console'

async function run(fn: (reviewerId: string) => Promise<unknown>): Promise<ReviewResult> {
  const viewer = await requireStaff('staff', '/admin/review')
  try {
    await fn(viewer.id)
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/admin/review')
  return { ok: true }
}

export async function approveAction(id: string, note: string): Promise<ReviewResult> {
  return run((reviewerId) => approve(db(), reviewerId, id, { note }))
}

export async function rejectAction(id: string, reasonCode: string, note: string): Promise<ReviewResult> {
  return run((reviewerId) => reject(db(), reviewerId, id, { reasonCode, note }))
}
