import { getBrand } from '@mde/config'
import { formatBps, formatUsd } from '@mde/money'
import {
  Button,
  CampaignCard,
  EmptyState,
  FrostedCard,
  IconChip,
  PageContainer,
  Play,
  RotatingBadge,
  Star,
  Table,
  TBody,
  TD,
  TR,
  Waveform,
  campaignTypeMeta,
  type CampaignType,
} from '@mde/ui'
import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getLiveCampaigns, type CampaignSummary } from '@/lib/campaigns'
import { loadSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

const steps = [
  [
    'Join a campaign',
    'Read the rate, the budget and every rule first. Nothing is hidden until after you join.',
  ],
  [
    'Link your account',
    'Verify your own account with a short code in your bio, or sign in with the platform.',
  ],
  [
    'Post and submit',
    'Publish on your own account and paste the link. Checks run at once and you see each result, with a reason if one fails.',
  ],
  [
    'Views are counted',
    'We check each post on a schedule. You are paid at the rate you saw when you submitted.',
  ],
  [
    'Get paid',
    'When the campaign closes and the review window ends, earnings become available. If a post is rejected, you can appeal.',
  ],
] as const

const panelTypes: { type: CampaignType; className: string }[] = [
  { type: 'clipping', className: 'left-[4%] top-[18%] -rotate-6' },
  { type: 'logo', className: 'right-[4%] top-[8%] rotate-3' },
  { type: 'music', className: 'left-[10%] bottom-[14%] rotate-2' },
  { type: 'ugc', className: 'right-[8%] bottom-[22%] -rotate-3' },
]

export default async function Home() {
  const brand = getBrand()
  let campaigns: CampaignSummary[] = []
  let failed = false
  let settings: Awaited<ReturnType<typeof loadSettings>> | null = null
  try {
    ;[campaigns, settings] = await Promise.all([getLiveCampaigns(4), loadSettings()])
  } catch {
    failed = true
  }

  const feeRow = settings
    ? settings.withdrawal_fee_bps === 0 && settings.withdrawal_fee_min_cents === 0
      ? 'None'
      : `${formatBps(settings.withdrawal_fee_bps)}${settings.withdrawal_fee_min_cents > 0 ? `, minimum ${formatUsd(settings.withdrawal_fee_min_cents)}` : ''}`
    : null

  return (
    <div className="mde-page">
      <SiteHeader brandName={brand.brandName} />

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-[1200px] px-6 pb-8 pt-10 md:pt-14">
          <div className="relative z-10 flex flex-col items-center text-center">
            <h1 className="font-display text-display-xl">
              Post it. Watch it grow.
              <br />
              <em>Get paid for every view.</em>
            </h1>
            <p className="mt-6 max-w-[520px] text-body-lg text-ink-2">
              Join a campaign, post on your own account, and earn for every view that counts. See
              the rules and the budget before you join.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild forward>
                <Link href="/sign-up">Start earning</Link>
              </Button>
              <Button asChild variant="secondary" leadingIcon={<Play size={10} />}>
                <Link href="/#how-it-works">How it works</Link>
              </Button>
            </div>
          </div>

          {/* Stage: image placeholder with frosted panels, floating cards and hairline curves */}
          <div className="relative mx-auto mt-12 max-w-[1100px]">
            <svg
              aria-hidden
              viewBox="0 0 1100 420"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            >
              <path
                d="M170 120 C 190 280, 290 360, 420 380"
                fill="none"
                stroke="var(--line-strong)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M930 160 C 910 280, 820 340, 690 370"
                fill="none"
                stroke="var(--line-strong)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div
              className="relative mx-auto aspect-[5/4] w-full max-w-[560px] overflow-hidden rounded-t-[28px] bg-line"
              role="img"
              aria-label="Photo of a creator goes here"
            >
              {panelTypes.map(({ type, className }, i) => (
                <FrostedCard
                  key={type}
                  className={`absolute flex items-center gap-3 !p-3 pr-5 ${className} mde-drift`}
                  style={{ animationDelay: `${i * 1.3}s` }}
                >
                  <IconChip type={type} size={36} />
                  <span className="text-body-sm">{campaignTypeMeta[type].label}</span>
                </FrostedCard>
              ))}
            </div>

            <FrostedCard
              className="mde-drift relative z-10 mx-auto mt-6 flex max-w-[280px] -rotate-3 flex-col gap-3 lg:absolute lg:left-0 lg:top-0 lg:mt-0"
              style={{ animationDelay: '0.6s' }}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-chip bg-lime">
                <Waveform size={18} />
              </span>
              <p className="font-display text-display-sm">Pay for views that count.</p>
              <p className="text-body-sm text-ink-2">
                The rate and the budget are on the page before you join.
              </p>
            </FrostedCard>

            <FrostedCard
              className="mde-drift relative z-10 mx-auto mt-6 flex max-w-[280px] rotate-3 flex-col gap-3 lg:absolute lg:right-0 lg:top-10 lg:mt-0"
              style={{ animationDelay: '2.2s' }}
            >
              <IconChip type="ugc" size={36} />
              <p className="font-display text-display-sm">Post on your own account.</p>
              <p className="text-body-sm text-ink-2">No new handles, no reposting.</p>
            </FrostedCard>

            <div className="absolute right-0 top-[-72px] hidden xl:block">
              <RotatingBadge text="Pay for views that count" />
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between gap-6 text-body-sm text-ink-2">
            <p className="flex items-center gap-2">
              <Star size={14} className="text-ink" />
              Clear rules before you join.
            </p>
            <p className="max-w-[220px] text-right">Clear fees. Clear reasons.</p>
          </div>
        </section>

        {/* Live campaigns */}
        <PageContainer id="campaigns" className="scroll-mt-8 pt-24">
          <div className="mb-8 flex items-end justify-between gap-6">
            <h2 className="font-display text-display-md">Live campaigns</h2>
            <Link href="/sign-up" className="text-body text-ink underline underline-offset-4">
              Sign up to join
            </Link>
          </div>
          {failed ? (
            <div className="border-y border-line">
              <EmptyState message="We could not load campaigns right now. Try again in a moment." />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="border-y border-line">
              <EmptyState message="No campaigns are live right now. Check back soon." />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  href={`/campaigns/${c.id}`}
                  LinkComponent={Link}
                />
              ))}
            </div>
          )}
        </PageContainer>

        {/* How it works */}
        <PageContainer id="how-it-works" className="scroll-mt-8 pt-32">
          <h2 className="font-display text-display-md">How it works</h2>
          <ol className="mt-10 flex flex-col">
            {steps.map(([title, body], i) => (
              <li
                key={title}
                className="grid grid-cols-[48px_1fr] gap-4 border-t border-line py-6 md:grid-cols-[96px_240px_1fr]"
              >
                <span className="font-display text-display-md tabular leading-none">{i + 1}</span>
                <h3 className="font-display text-display-sm md:self-start">{title}</h3>
                <p className="col-start-2 max-w-xl text-body text-ink-2 md:col-start-3">{body}</p>
              </li>
            ))}
          </ol>
        </PageContainer>

        {/* Fees */}
        <PageContainer id="fees" className="scroll-mt-8 pt-32">
          <h2 className="font-display text-display-md">Fees</h2>
          <p className="mt-3 max-w-xl text-body text-ink-2">
            Every fee a creator or a client can pay, in one place.
          </p>
          <div className="mt-8 max-w-3xl">
            {settings && feeRow ? (
              <Table>
                <TBody>
                  <TR>
                    <TD className="py-4 pr-6">Fee to creators when they withdraw</TD>
                    <TD className="text-right text-ink">{feeRow}</TD>
                  </TR>
                  <TR>
                    <TD className="py-4 pr-6">Minimum withdrawal</TD>
                    <TD className="tabular text-right text-ink">
                      {formatUsd(settings.withdrawal_min_cents)}
                    </TD>
                  </TR>
                  <TR>
                    <TD className="py-4 pr-6">Review window after a campaign closes</TD>
                    <TD className="text-right text-ink">
                      {settings.review_window_days}{' '}
                      {settings.review_window_days === 1 ? 'day' : 'days'}
                    </TD>
                  </TR>
                  <TR>
                    <TD className="py-4 pr-6">Service fee for clients</TD>
                    <TD className="text-right text-ink">Agreed with each client before funding</TD>
                  </TR>
                </TBody>
              </Table>
            ) : (
              <div className="border-y border-line">
                <EmptyState message="We could not load the fees right now. Try again in a moment." />
              </div>
            )}
          </div>
        </PageContainer>

        {/* For clients */}
        <PageContainer id="clients" className="scroll-mt-8 pt-32">
          <div className="grid gap-10 border-t border-line pt-12 md:grid-cols-2">
            <h2 className="font-display text-display-md">For clients</h2>
            <div className="flex flex-col gap-6">
              <p className="text-body-lg text-ink-2">
                You fund a budget. Creators post on their own accounts. You pay a set rate per 1,000
                counted views, and you get a private report link with spend, views and every post.
              </p>
              {brand.contactEmail.includes('@') ? (
                <Button asChild variant="secondary" className="self-start">
                  <a href={`mailto:${brand.contactEmail}`}>Talk to us</a>
                </Button>
              ) : null}
            </div>
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  )
}
