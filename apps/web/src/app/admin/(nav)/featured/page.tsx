import { listPublicCampaigns, PLATFORM_LABELS, TEMPLATES, type CampaignType, type Platform } from '@mde/campaigns'
import { db } from '@mde/db'
import { loadContentOverrides } from '@/lib/content'
import { requireStaff } from '@/server/guard'
import { AdminPage, LinkButton } from '../_components/ui'
import { FeaturedForm } from './form'

export const dynamic = 'force-dynamic'

// The featured campaign at the top of the campaigns screen (owner request, 2026-10-07). Admin only.
export default async function FeaturedPage() {
  await requireStaff('admin', '/admin/featured')
  const [all, content] = await Promise.all([listPublicCampaigns(db()), loadContentOverrides('browse')])
  const live = all
    .filter((x) => x.campaign.status === 'live')
    .map(({ campaign: c }) => ({
      id: c.id,
      title: c.title,
      tags: [TEMPLATES[c.type as CampaignType].label, PLATFORM_LABELS[c.platforms[0] as Platform] ?? ''].join(', '),
    }))
  const chosen = live.some((c) => c.id === content['featured.campaign']) ? content['featured.campaign']! : ''
  return (
    <AdminPage
      title="Featured campaign"
      lead="The big campaign at the top of the creators' campaigns screen. Without a choice, the longest-running live campaign is shown."
      actions={
        <LinkButton href="/campaigns" variant="secondary">
          View campaigns screen
        </LinkButton>
      }
    >
      <FeaturedForm
        campaigns={live}
        values={{
          campaign: chosen,
          title: chosen ? (content['featured.title'] ?? '') : '',
          body: chosen ? (content['featured.body'] ?? '') : '',
          tags: chosen ? (content['featured.tags'] ?? '') : '',
          image: content['featured.image'] ?? '',
        }}
      />
    </AdminPage>
  )
}
