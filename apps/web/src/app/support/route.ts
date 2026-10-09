import { brand } from '@mde/config'

export const dynamic = 'force-dynamic'

// The menu's Support item: the Discord server where creators open a ticket (testing report, 2026-10-08),
// or the help page until SUPPORT_DISCORD_URL is set.
export function GET() {
  return new Response(null, { status: 307, headers: { Location: brand().supportDiscordUrl ?? '/help' } })
}
