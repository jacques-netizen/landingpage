import 'server-only'
import { headers } from 'next/headers'

export async function clientIp() {
  const h = await headers()
  return (h.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || h.get('x-real-ip') || 'unknown'
}
