import 'server-only'
import { listPublicCampaigns, PLATFORM_LABELS, TEMPLATES, type CampaignType, type Platform } from '@mde/campaigns'
import { db, getContentOverrides } from '@mde/db'
import { cookies } from 'next/headers'
import type { BrowseCard, BrowseFeatured } from '@/designed/browse-view'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { shownFigures } from '@/lib/shown-figures'
import { getViewer } from './viewer'

const opened = (c: { startAt: Date | null; createdAt: Date }) => (c.startAt ?? c.createdAt).getTime()

async function liveCampaigns() {
  const all = await listPublicCampaigns(db())
  return all
    .filter((x) => x.campaign.status === 'live')
    .sort(
      (a, b) =>
        opened(a.campaign) - opened(b.campaign) || a.campaign.createdAt.getTime() - b.campaign.createdAt.getTime(),
    )
}

/** Live public campaigns as cards, oldest first: campaigns that opened first lead the list. */
export async function loadCards(): Promise<BrowseCard[]> {
  const live = await liveCampaigns()
  return live.map(({ campaign: c, figures: f }) => ({
    id: c.id,
    title: c.title,
    label: TEMPLATES[c.type as CampaignType].label,
    leftCents: f.leftCents,
    rateCents: c.rateCentsPer1000,
    paidPercent: f.paidPercent,
    platforms: c.platforms.map((p) => PLATFORM_LABELS[p as Platform] ?? p),
    img: c.coverImageUrl,
  }))
}

/** Public campaigns that have ended or are ending, most recent first (owner request, 2026-10-07). */
export async function loadPastCards(): Promise<BrowseCard[]> {
  const all = await listPublicCampaigns(db())
  return all
    .filter((x) => x.campaign.status === 'closed' || x.campaign.status === 'closing')
    .sort(
      (a, b) =>
        (b.campaign.endAt ?? b.campaign.createdAt).getTime() - (a.campaign.endAt ?? a.campaign.createdAt).getTime(),
    )
    .slice(0, 12)
    .map(({ campaign: c, figures }) => ({ c, f: shownFigures(c.status, figures) }))
    .map(({ c, f }) => ({
      id: c.id,
      title: c.title,
      label: c.status === 'closed' ? 'Ended' : 'Ending',
      leftCents: f.leftCents,
      rateCents: c.rateCentsPer1000,
      paidPercent: f.paidPercent,
      platforms: c.platforms.map((p) => PLATFORM_LABELS[p as Platform] ?? p),
      img: c.coverImageUrl,
    }))
}

/**
 * The featured campaign and the screen's copy. Staff choose the campaign and its words in settings
 * (content.browse); otherwise it is the first live campaign, in its own words.
 */
export async function loadFeatured(): Promise<{ featured: BrowseFeatured | null; overrides: Record<string, string> }> {
  const content = await getContentOverrides(db(), 'browse')
  const live = await liveCampaigns()
  const pick = live.find((x) => x.campaign.id === content['featured.campaign']) ?? live[0]
  if (!pick) return { featured: null, overrides: content }
  const c = pick.campaign
  const staffCopy = c.id === content['featured.campaign']
  const tags = (
    staffCopy && content['featured.tags']
      ? content['featured.tags'].split(',')
      : [TEMPLATES[c.type as CampaignType].label, PLATFORM_LABELS[c.platforms[0] as Platform] ?? '']
  ).map((t) => t.trim())
  return {
    overrides: content,
    featured: {
      id: c.id,
      title: (staffCopy && content['featured.title']) || c.title,
      body: (staffCopy && content['featured.body']) || '',
      tag1: tags[0] ?? '',
      tag2: tags[1] ?? '',
      leftCents: pick.figures.leftCents,
      // The featured campaign's own picture (owner request, 2026-10-07), unless staff uploaded a
      // different one for it at /admin/featured.
      img: (staffCopy && content['featured.image']) || c.coverImageUrl || undefined,
    },
  }
}

export async function browseChrome() {
  const [viewer, jar] = await Promise.all([getViewer(), cookies()])
  return {
    theme: readThemeCookie(jar.get(THEME_COOKIE)?.value),
    account: viewer ? { label: 'Sign out', href: '/sign-out' } : { label: 'Sign in', href: '/sign-in?next=/campaigns' },
    signedIn: !!viewer,
  }
}
