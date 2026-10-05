'use server'

import { brand } from '@mde/config'
import { z } from 'zod'
import { clientIp } from '@/server/client-ip'
import { escapeHtml, sendEmail } from '@/server/email'
import { rateLimit } from '@/server/rate-limit'

export type EnquiryState = {
  ok?: boolean
  error?: string
  fields?: Partial<Record<'name' | 'email' | 'company' | 'message', string>>
  values?: Record<string, string>
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'Use 120 characters or fewer.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter an email address, like name@example.com.')),
  company: z.string().trim().min(1, 'Enter your company or artist name.').max(160, 'Use 160 characters or fewer.'),
  budget: z.string().trim().max(60),
  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little about the campaign, at least 10 characters.')
    .max(4000, 'Use 4,000 characters or fewer.'),
})

// The enquiry form emails staff (01_PRODUCT.md 8.1). Limited per address and per sender, with a
// hidden field that people never fill and simple bots do.
export async function sendEnquiry(_prev: EnquiryState, form: FormData): Promise<EnquiryState> {
  const raw = Object.fromEntries(
    ['name', 'email', 'company', 'budget', 'message'].map((k) => [k, String(form.get(k) ?? '')]),
  )
  if (String(form.get('website') ?? '') !== '') return { ok: true }
  if (!(await rateLimit(`enquiry:ip:${await clientIp()}`, 5, 3600)))
    return { error: 'Too many messages from here. Wait an hour, or email us directly.', values: raw }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fields: EnquiryState['fields'] = {}
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as keyof NonNullable<EnquiryState['fields']>
      fields[k] ??= issue.message
    }
    return { fields, values: raw }
  }
  const e = parsed.data
  if (!(await rateLimit(`enquiry:email:${e.email}`, 3, 3600)))
    return { error: 'Too many messages from this address. Wait an hour, or email us directly.', values: raw }

  const lines = [
    `Name: ${e.name}`,
    `Email: ${e.email}`,
    `Company: ${e.company}`,
    `Budget: ${e.budget || 'Not given'}`,
    '',
    e.message,
  ]
  try {
    await sendEmail({
      to: brand().contactEmail,
      subject: 'New client enquiry',
      text: lines.join('\n'),
      html: `<pre style="font:15px/1.5 Archivo,Arial,sans-serif;color:#1A1510;white-space:pre-wrap">${escapeHtml(lines.join('\n'))}</pre>`,
    })
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'enquiry email failed', err: String(err) }))
    return { error: 'Your message did not send. Try again, or email us directly.', values: raw }
  }
  return { ok: true }
}
