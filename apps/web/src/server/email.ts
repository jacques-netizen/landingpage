import 'server-only'

// Email sending lives in @mde/notifications so the worker sends notification emails the same way.
export { DEV_OUTBOX, escapeHtml, sendEmail, withFooter, type Email } from '@mde/notifications/email'
