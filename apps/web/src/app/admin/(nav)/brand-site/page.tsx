import { brandsDataContent } from '@/designed/brands.data'
import { requireStaff } from '@/server/guard'
import { loadContentOverrides } from '@/lib/content'
import { AdminPage, LinkButton } from '../_components/ui'
import { BrandSiteForm } from './forms'
import { BRAND_SITE_SLOTS } from './keys'

export const dynamic = 'force-dynamic'

// The brand site's videos, posters and booking link. The layout and words stay as designed; this
// only fills the media slots the design has. Admin only; every save is audited.
export default async function BrandSitePage() {
  await requireStaff('admin', '/admin/brand-site')
  const overrides = await loadContentOverrides('brands')
  const defaults = brandsDataContent as Record<string, string>
  const values = Object.fromEntries(BRAND_SITE_SLOTS.map((s) => [s.key, overrides[s.key] ?? defaults[s.key] ?? '']))
  return (
    <AdminPage
      title="Brand site"
      lead="Upload the case study videos, the testimonial and the clips in the phone frames. Save when you are done."
      actions={
        <LinkButton href="/brands" variant="secondary">
          View brand site
        </LinkButton>
      }
    >
      <BrandSiteForm slots={BRAND_SITE_SLOTS} values={values} />
    </AdminPage>
  )
}
