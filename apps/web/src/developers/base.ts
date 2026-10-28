import 'server-only'
import { env } from '@mde/config'

/** The API's base address as this deployment serves it, for the examples. */
export const apiUrl = () => `${env().APP_URL.replace(/\/$/, '')}/api/v1`
/** Where partners ask for access: the contact email when one is set. */
export function contactEmail() {
  const e = env().CONTACT_EMAIL
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null
}
