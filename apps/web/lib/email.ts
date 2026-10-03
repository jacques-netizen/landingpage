import { getBrand } from '@mde/config'

type Mail = { to: string; subject: string; text: string; html: string }

/**
 * Sends through Resend when EMAIL_API_KEY is set. Without it, the message is printed to the server
 * console so development works with only DATABASE_URL, REDIS_URL and AUTH_SECRET set.
 */
export async function sendEmail(mail: Mail) {
  const key = process.env.EMAIL_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) {
    // End to end tests read sent mail from a file instead of scraping the console.
    if (process.env.DEV_EMAIL_OUTBOX) {
      const { appendFile } = await import('node:fs/promises')
      await appendFile(process.env.DEV_EMAIL_OUTBOX, JSON.stringify(mail) + '\n')
    }
    console.log(`\n[dev email] to ${mail.to}\n${mail.subject}\n${mail.text}\n`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  })
  if (!res.ok) throw new Error(`Email send failed with status ${res.status}`)
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

/** Sign in link email. No amounts or reasons in the subject. Legal entity in the footer. */
export function signInEmail(to: string, url: string): Mail {
  const brand = getBrand()
  const subject = `Your sign in link for ${brand.brandName}`
  const text = [
    `Use this link to sign in to ${brand.brandName}. It works once and expires in 15 minutes.`,
    '',
    url,
    '',
    'If you did not ask for this, you can ignore this email.',
    '',
    brand.legalEntity,
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#F6F4EF;font-family:Helvetica,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="font-family:Georgia,serif;font-size:28px;padding-bottom:24px">${escapeHtml(brand.brandName)}</td></tr>
<tr><td style="font-size:15px;line-height:1.5;padding-bottom:24px">Use this link to sign in. It works once and expires in 15 minutes.</td></tr>
<tr><td style="padding-bottom:32px"><a href="${escapeHtml(url)}" style="background:#111111;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:15px;display:inline-block">Sign in</a></td></tr>
<tr><td style="font-size:13px;line-height:1.45;color:#5F5C57">If you did not ask for this, you can ignore this email.<br><br>${escapeHtml(brand.legalEntity)}</td></tr>
</table></td></tr></table></body></html>`
  return { to, subject, text, html }
}
