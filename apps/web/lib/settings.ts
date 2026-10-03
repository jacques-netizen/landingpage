import { getSettings } from '@mde/db'
import { getDb } from '@/lib/db'

export async function loadSettings() {
  return getSettings(getDb())
}
