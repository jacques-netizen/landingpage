import 'server-only'

// Input checks shared by server actions (owner, 2026-11-13: strict input validation on all user inputs).
// A browser can call a server action with any arguments, so values that arrive from it are checked here
// before they reach a query, and long text is refused rather than stored.

/** A record id: a UUID. Anything else is refused before it reaches the database. */
export const isId = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** A form field as trimmed text, or null when it is longer than the limit. */
export function formText(form: FormData, key: string, max: number): string | null {
  const v = form.get(key)
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length > max ? null : s
}
