import { brand } from '@mde/config'
import { Footer, PublicNav } from '@mde/ui'
import type { ReactNode } from 'react'

export function footerColumns() {
  const b = brand()
  return [
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Creator Terms of Use', href: '/legal/terms' },
        { label: 'Brand Terms of Use', href: '/legal/brand-terms' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'Contact Us', href: `mailto:${b.contactEmail}` },
        { label: 'Support', href: b.supportDiscordUrl ?? '/help' },
        { label: 'Fees', href: '/fees' },
      ],
    },
  ]
}

// Public pages the mockups do not show: the home page's nav and the brand site's footer around a
// paper-style page (05_DESIGN_SYSTEM.md sections 4 and 8).
export function PublicLayout({ children }: { children: ReactNode }) {
  const b = brand()
  return (
    <div className="min-h-screen bg-page font-sans text-ink">
      <PublicNav
        links={[
          { label: 'Campaigns', href: '/campaigns' },
          { label: 'Wallet', href: '/wallet' },
        ]}
        cta={{ label: 'Start earning', href: '/sign-up' }}
      />
      <main className="mx-auto box-border max-w-[1200px] px-6 pt-16 pb-28 max-sm:pt-8">{children}</main>
      <Footer
        columns={footerColumns()}
        legalLine={`© ${new Date().getFullYear()} ${b.legalEntity}. All rights reserved.`}
      />
    </div>
  )
}

/** Serif headline in the home page's style: one regular line and one italic line. */
export function PageHeading({ title, italic, lead }: { title: string; italic?: string; lead?: ReactNode }) {
  return (
    <header className="mb-14">
      <h1 className="m-0 max-w-[860px] font-serif text-[64px] leading-none font-normal tracking-[-0.02em] max-sm:text-[40px]">
        {title}
        {italic ? (
          <>
            <br />
            <em>{italic}</em>
          </>
        ) : null}
      </h1>
      {lead ? <p className="mt-6 mb-0 max-w-[560px] text-[18px] leading-[1.45] text-muted">{lead}</p> : null}
    </header>
  )
}
