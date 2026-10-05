'use server'

import { createClient, recordClientFunding, updateClient } from '@mde/campaigns'
import { db } from '@mde/db'
import { parseDollarsToCents } from '@mde/money/dollars'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireStaff } from '@/server/guard'

export type FormState = { error?: string; fields?: Record<string, string>; ok?: string }

const clientSchema = z.object({
  name: z.string().trim().min(1, 'Enter the client name.').max(200),
  contactName: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter an email address, like name@example.com.')
    .transform((v) => v || null),
  serviceFee: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const m = /^(\d{1,3})(?:\.(\d{1,2}))?%?$/.exec(v === '' ? '0' : v)
      if (!m) {
        ctx.addIssue({ code: 'custom', message: 'Enter the service fee as a percent, like 10 or 12.5.' })
        return z.NEVER
      }
      const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
      if (bps > 10_000) {
        ctx.addIssue({ code: 'custom', message: 'The fee cannot be more than 100%.' })
        return z.NEVER
      }
      return bps
    }),
  notes: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => v || null),
})

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {}
  for (const i of error.issues) out[String(i.path[0] ?? 'form')] ??= i.message
  return out
}

function read(form: FormData) {
  return {
    name: String(form.get('name') ?? ''),
    contactName: String(form.get('contactName') ?? ''),
    contactEmail: String(form.get('contactEmail') ?? ''),
    serviceFee: String(form.get('serviceFee') ?? ''),
    notes: String(form.get('notes') ?? ''),
  }
}

export async function saveClientAction(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const viewer = await requireStaff('money')
  const parsed = clientSchema.safeParse(read(form))
  if (!parsed.success) return { fields: fieldErrors(parsed.error) }
  const v = {
    name: parsed.data.name,
    contactName: parsed.data.contactName,
    contactEmail: parsed.data.contactEmail,
    serviceFeeBps: parsed.data.serviceFee,
    notes: parsed.data.notes,
  }
  if (id) {
    await updateClient(db(), viewer.id, id, v)
    revalidatePath(`/admin/clients/${id}`)
    return { ok: 'Saved.' }
  }
  const c = await createClient(db(), viewer.id, v)
  redirect(`/admin/clients/${c.id}`)
}

const fundingSchema = z.object({
  amount: z.string().transform((v, ctx) => {
    const r = parseDollarsToCents(v)
    if (!r.ok) {
      ctx.addIssue({ code: 'custom', message: r.message })
      return z.NEVER
    }
    if (r.cents <= 0) {
      ctx.addIssue({ code: 'custom', message: 'The amount must be more than $0.00.' })
      return z.NEVER
    }
    return r.cents
  }),
  reference: z.string().trim().min(1, 'Enter the invoice or bank reference.').max(200),
})

/** Finance records money the client paid by invoice or bank transfer. */
export async function recordFundingAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const viewer = await requireStaff('money')
  const parsed = fundingSchema.safeParse({
    amount: String(form.get('amount') ?? ''),
    reference: String(form.get('reference') ?? ''),
  })
  if (!parsed.success) return { fields: fieldErrors(parsed.error) }
  const r = await recordClientFunding(db(), viewer.id, {
    clientId,
    amountCents: parsed.data.amount,
    reference: parsed.data.reference,
  })
  revalidatePath(`/admin/clients/${clientId}`)
  return r.created
    ? { ok: 'Funding recorded.' }
    : { error: 'That reference was already recorded for this client. Nothing was added.' }
}
