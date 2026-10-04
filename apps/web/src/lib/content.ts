import 'server-only'
import { db, getContentOverrides, type ContentOverrides, type ContentPage } from '@mde/db'

// Staff overrides for a designed page. If settings cannot be read, the page still renders with the
// approved copy rather than failing: the marketing pages must stay up.
export async function loadContentOverrides(page: ContentPage): Promise<ContentOverrides> {
  try {
    return await getContentOverrides(db(), page)
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'content overrides unavailable', page, err: String(err) }))
    return {}
  }
}
