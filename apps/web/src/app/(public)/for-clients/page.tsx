import type { Metadata } from 'next'
import Link from 'next/link'
import { brand } from '@mde/config'
import { PageHeading } from '@/components/public-page'
import { EnquiryForm } from './enquiry-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "For clients | Maison d'Élites" }

const GETS = [
  [
    'You pay for views',
    'Creators earn a set rate for every 1,000 counted views. When the budget is used, the campaign stops.',
  ],
  [
    'Every post is reviewed',
    'Each post passes automatic checks and a person before it earns. Suspicious view jumps pause earnings for a check.',
  ],
  [
    'A private report',
    'A link that shows spend, views, posts and the cost per 1,000 views, with every post listed and a CSV download.',
  ],
] as const

const RUNS = [
  'We agree the brief, the rules and the budget with you.',
  'You pay the budget and the service fee by invoice or bank transfer. The campaign goes live only when it is fully funded.',
  'Creators join, post on their own accounts and submit the links. Views are counted on a schedule.',
  'The campaign closes when the budget is used or the end date arrives. Unused budget is refunded or credited to you.',
] as const

// What clients get, how a campaign runs, and an enquiry form that emails staff (01_PRODUCT.md 8.1).
export default function ForClientsPage() {
  const { contactEmail } = brand()
  return (
    <>
      <PageHeading
        title="Put your content"
        italic="to work."
        lead="Campaigns that pay creators for the views they bring. You fund the budget, we run the rest."
      />
      <section className="grid max-w-[1100px] grid-cols-3 gap-8 max-md:grid-cols-1">
        {GETS.map(([t, b]) => (
          <div key={t} className="border-0 border-t border-solid border-line pt-6">
            <h2 className="m-0 font-serif text-[28px] leading-[1.1] font-normal">{t}</h2>
            <p className="mt-3 mb-0 text-[15px] leading-[1.6] text-muted">{b}</p>
          </div>
        ))}
      </section>

      <section className="mt-24 max-w-[860px]">
        <h2 className="m-0 font-serif text-[40px] leading-[1.05] font-normal max-sm:text-[32px]">
          How a campaign runs
        </h2>
        <ol className="mt-8 mb-0 list-none p-0">
          {RUNS.map((r, i) => (
            <li
              key={r}
              className="grid grid-cols-[56px_1fr] gap-4 border-0 border-t border-solid border-line py-5 text-[15px] leading-[1.6]"
            >
              <span className="font-serif text-[28px] leading-none text-muted-2">{i + 1}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 mb-0 text-[15px] text-muted">
          The service fee is listed on the <Link href="/fees">fees page</Link>. See our results on the{' '}
          <Link href="/brands">brand site</Link>.
        </p>
      </section>

      <section id="enquire" className="mt-24 max-w-[760px]">
        <h2 className="m-0 font-serif text-[40px] leading-[1.05] font-normal max-sm:text-[32px]">Start a campaign</h2>
        <p className="mt-3 mb-8 text-[15px] text-muted">
          Tell us what you would like to promote. Or email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
        <EnquiryForm contactEmail={contactEmail} />
      </section>
    </>
  )
}
