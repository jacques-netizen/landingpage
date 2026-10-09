import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { shownFigures } from '@/lib/shown-figures'
import {
  getPublicCampaign,
  isMember,
  PLATFORM_LABELS,
  recentPosts,
  TEMPLATES,
  type CampaignType,
  type Platform,
} from '@mde/campaigns'
import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppFrame } from '@/components/app-frame'
import { LocalDateTime } from '@/components/local-time'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { getViewer, hasAccess } from '@/server/viewer'
import { listAccounts } from '@mde/platforms'
import { JoinPanel } from './join-panel'
import { SubmitPanel } from './submit-panel'

export const dynamic = 'force-dynamic'

const date = (d: Date) => d.toLocaleDateString('en-US', { dateStyle: 'long' })
const count = (n: number) => n.toLocaleString('en-US')

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await getPublicCampaign(db(), id)
  return { title: data ? `${data.campaign.title} | Maison d'Élites` : "Campaign | Maison d'Élites" }
}

function Rule({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,220px)_1fr] gap-6 border-0 border-b border-solid border-[var(--t-hair)] py-[13px] text-[14px] max-sm:grid-cols-1 max-sm:gap-1">
      <dt className="text-[var(--t-muted)]">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="m-0 mb-3 text-[22px] font-bold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  )
}

const panel =
  'rounded-[24px] border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] backdrop-blur-[20px]'

// A campaign's page: everything a creator needs to decide, with every rule shown before joining
// (01_PRODUCT.md section 6.3). Not in the mockups, so it is built in the campaigns screen's style.
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getViewer()
  const isStaff = hasAccess(viewer, 'staff')
  const d = db()
  const data = await getPublicCampaign(d, id, { includeUnpublished: isStaff })
  if (!data) notFound()
  const { campaign: c, terms } = data
  const f = shownFigures(c.status, data.figures)
  const ended = c.status === 'closed' || c.status === 'closing'
  const usedLabel = `${formatDollars(f.paidCents)}/${formatDollars(f.budgetCents)}`
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const template = TEMPLATES[c.type as CampaignType]
  const status = CAMPAIGN_STATUS[c.status]
  const published = ['live', 'closing', 'closed'].includes(c.status)
  const posts = published ? await recentPosts(d, c.id) : []
  const member = viewer ? await isMember(d, viewer.id, c.id) : false
  const now = new Date()
  const opensLater = c.startAt && c.startAt > now ? date(c.startAt) : null
  const joinState = !published
    ? 'preview'
    : c.status !== 'live'
      ? 'closed'
      : !viewer
        ? 'signed-out'
        : member
          ? 'joined'
          : 'can-join'
  const platforms = c.platforms.map((p) => PLATFORM_LABELS[p as Platform] ?? p)
  // Joined creators submit here once submissions are open: their verified accounts on this campaign's platforms.
  const canSubmit = joinState === 'joined' && !opensLater
  const accounts = canSubmit
    ? (await listAccounts(d, viewer!.id))
        .filter((a) => a.status === 'verified' && c.platforms.includes(a.platform))
        .map((a) => ({ id: a.id, label: `${PLATFORM_LABELS[a.platform as Platform] ?? a.platform} @${a.handle}` }))
    : []
  const tf = c.templateFields

  return (
    <AppFrame theme={theme} active="campaigns" signedIn={!!viewer}>
      {!published ? (
        <p className="m-0 mb-4 rounded-[16px] border border-solid border-[rgba(224,169,74,0.45)] bg-[rgba(224,169,74,0.16)] px-5 py-[14px] text-[14px]">
          Staff preview. This campaign is {status?.label.toLowerCase() ?? c.status} and not visible to creators yet.
        </p>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-4 max-lg:grid-cols-1">
        <article className={`${panel} p-8 max-sm:p-5`}>
          {c.coverImageUrl ? (
            <img
              src={c.coverImageUrl}
              alt=""
              className="mb-7 block h-[260px] w-full rounded-[18px] object-cover max-sm:h-[200px]"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[template.label, ...platforms].map((t) => (
              <span
                key={t}
                className="flex h-7 items-center rounded-pill border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] px-3 text-[12px] font-semibold"
              >
                {t}
              </span>
            ))}
            <span className="flex h-7 items-center gap-2 px-2 text-[12px] font-semibold text-[var(--t-muted)]">
              <span
                aria-hidden
                className="size-[7px] rounded-full"
                style={{ background: c.status === 'live' ? '#4FB286' : '#E0A94A' }}
              />
              {opensLater && c.status === 'live' ? `Opens ${opensLater}` : status?.label}
            </span>
          </div>
          <h1 className="mt-4 mb-0 text-[44px] leading-[1.05] font-bold tracking-[-0.02em] max-sm:text-[32px]">
            {c.title}
          </h1>
          {c.briefMarkdown ? (
            <p className="mt-4 mb-0 max-w-[640px] text-[15px] leading-[1.6] whitespace-pre-line text-[var(--t-muted)]">
              {c.briefMarkdown}
            </p>
          ) : null}

          {c.assets.length ? (
            <Section title="Assets">
              <ul className="m-0 list-none p-0">
                {c.assets.map((a) => (
                  <li
                    key={a.url}
                    className="border-0 border-b border-solid border-[var(--t-hair)] py-[13px] text-[14px]"
                  >
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--t-text)] hover:text-[var(--t-accent-ink)]"
                    >
                      {a.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Money">
            <dl className="m-0">
              <Rule label="Rate">{formatDollars(c.rateCentsPer1000)} per 1,000 counted views</Rule>
              <Rule label="Budget">{formatDollars(f.budgetCents)}</Rule>
              {ended ? (
                <Rule label="Paid to creators">{usedLabel}</Rule>
              ) : (
                <>
                  <Rule label="Paid to creators so far">{formatDollars(f.paidCents)}</Rule>
                  <Rule label="Left in budget">{formatDollars(f.leftCents)}</Rule>
                </>
              )}
              <Rule label="Most one post can earn">
                {c.capPerPostCents === null ? 'No limit' : formatDollars(c.capPerPostCents)}
              </Rule>
              <Rule label="Most one creator can earn">
                {c.capPerCreatorCents === null ? 'No limit' : formatDollars(c.capPerCreatorCents)}
              </Rule>
              <Rule label="Minimum views to earn">
                {c.minViewsToEarn > 0
                  ? `${count(c.minViewsToEarn)} counted views. Posts below this earn nothing until they pass it.`
                  : 'None'}
              </Rule>
              <Rule label="Engagement">
                {c.minEngagementBps === null
                  ? 'No minimum'
                  : `At least ${(c.minEngagementBps / 100).toFixed(2)}% (likes, comments and shares divided by views)`}
              </Rule>
            </dl>
          </Section>

          <Section title="Account rules">
            <dl className="m-0">
              <Rule label="Platforms">{platforms.join(', ')}</Rule>
              <Rule label="Minimum followers">{c.minFollowers === null ? 'None' : count(c.minFollowers)}</Rule>
              <Rule label="Minimum account age">
                {c.minAccountAgeDays === null ? 'None' : `${count(c.minAccountAgeDays)} days`}
              </Rule>
              <Rule label="Posts per linked account">
                {c.maxPostsPerAccount === null ? 'No limit' : count(c.maxPostsPerAccount)}
              </Rule>
              <Rule label="Languages">{c.languages?.length ? c.languages.join(', ') : 'Any'}</Rule>
              <Rule label="Audience regions">
                {c.allowedRegions?.length ? `Only ${c.allowedRegions.join(', ')}` : 'Any'}
                {c.blockedRegions?.length ? `. Not ${c.blockedRegions.join(', ')}` : ''}
              </Rule>
            </dl>
          </Section>

          <Section title="Content rules">
            <dl className="m-0">
              <Rule label="Required hashtags">
                {c.requiredHashtags?.length ? c.requiredHashtags.join(' ') : 'None'}
              </Rule>
              <Rule label="Minimum duration">
                {c.minDurationSeconds === null ? 'None' : `${c.minDurationSeconds} seconds`}
              </Rule>
              {template.fields.map((field) =>
                tf[field.key] === undefined || tf[field.key] === '' ? null : (
                  <Rule key={field.key} label={field.label}>
                    {field.kind === 'boolean' ? (
                      tf[field.key] ? (
                        'Yes'
                      ) : (
                        'No'
                      )
                    ) : field.kind === 'url' ? (
                      <a href={String(tf[field.key])}>Open</a>
                    ) : (
                      String(tf[field.key])
                    )}
                  </Rule>
                ),
              )}
              <Rule label="How posts are checked">{template.checks.join('. ')}.</Rule>
              <Rule label="Keep the post up">For {c.keepLiveDays} days after the campaign closes</Rule>
            </dl>
          </Section>

          <Section title="Dates">
            <dl className="m-0">
              <Rule label="Submissions open">
                {c.startAt ? <LocalDateTime iso={c.startAt.toISOString()} /> : 'Now'}
              </Rule>
              <Rule label="Submissions close">
                {c.endAt ? <LocalDateTime iso={c.endAt.toISOString()} /> : 'When the budget is used'}
              </Rule>
            </dl>
          </Section>

          {terms ? (
            <Section title="Campaign rules">
              <p className="m-0 text-[15px] leading-[1.6] whitespace-pre-line">{terms.bodyMarkdown}</p>
              <p className="mt-4 mb-0 text-[13px] text-[var(--t-muted)]">
                Rules in force since {date(terms.effectiveAt)}. Each post is paid under the rules in force when it was
                submitted.
              </p>
            </Section>
          ) : null}

          <Section title="Recent posts">
            {posts.length ? (
              <ul className="m-0 list-none p-0">
                {posts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-4 border-0 border-b border-solid border-[var(--t-hair)] py-[13px] text-[14px]"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[var(--t-muted)]">
                      {PLATFORM_LABELS[p.platform as Platform] ?? p.platform} · {count(p.countedViews)} counted views
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[14px] text-[var(--t-muted)]">
                No approved posts yet. Posts appear here once they pass review.
              </p>
            )}
          </Section>
        </article>

        <aside className={`${panel} sticky top-4 p-6 max-lg:static`}>
          <div className="text-[12px] font-semibold tracking-[0.06em] text-[var(--t-muted)] uppercase">
            {ended ? 'Budget paid out' : 'Left in budget'}
          </div>
          {ended ? (
            // Ended campaigns show what was paid out of the budget, not "$0 left" (testing report, 2026-10-08).
            <div
              className="mt-2 text-[28px] leading-tight font-bold tracking-[-0.02em] tabular-nums"
              style={{ color: 'var(--t-accent-ink)' }}
            >
              {usedLabel}
            </div>
          ) : (
            <>
              <div
                className="mt-2 text-[44px] leading-none font-bold tracking-[-0.03em] tabular-nums"
                style={{ color: 'var(--t-accent-ink)' }}
              >
                {formatDollars(f.leftCents)}
              </div>
              <div className="mt-2 text-[13px] text-[var(--t-muted)]">of {formatDollars(f.budgetCents)}</div>
            </>
          )}
          <div
            className="mt-4 h-1 rounded-[2px] bg-[var(--t-hair2)]"
            role="img"
            aria-label={`${f.paidPercent}% of the budget paid`}
          >
            <div className="h-full rounded-[2px] bg-gold-soft" style={{ width: `${Math.min(100, f.paidPercent)}%` }} />
          </div>
          <dl className="mt-5 mb-6 text-[13px]">
            {[
              // No rate in the budget box (testing report, 2026-10-08); it stays in the Money rules.
              ['Platforms', platforms.join(', ')],
              ['Opens', c.startAt ? date(c.startAt) : 'Now'],
              ['Closes', c.endAt ? date(c.endAt) : 'When the budget is used'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-0 border-b border-solid border-[var(--t-hair)] py-[10px]"
              >
                <dt className="text-[var(--t-muted)]">{k}</dt>
                <dd className="m-0 text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {canSubmit ? (
            <SubmitPanel campaignId={c.id} accounts={accounts} theme={theme === 'light' ? 'glass' : 'dark'} />
          ) : (
            <JoinPanel
              campaignId={c.id}
              state={joinState}
              isPrivate={c.visibility === 'private'}
              opensLabel={opensLater}
            />
          )}
        </aside>
      </div>
    </AppFrame>
  )
}
