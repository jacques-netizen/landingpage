import { getBrand } from '@mde/config'
import { Footer } from '@mde/ui'

export function SiteFooter() {
  const brand = getBrand()
  return (
    <Footer
      brandName={brand.brandName}
      legalEntity={brand.legalEntity}
      links={[
        { href: '/legal/terms', label: 'Terms' },
        { href: '/legal/privacy', label: 'Privacy' },
        { href: '/legal/campaign-rules', label: 'Campaign rules' },
        { href: '/sign-in', label: 'Sign in' },
      ]}
    />
  )
}
