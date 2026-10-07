import type { Metadata } from 'next'
import { brand } from '@mde/config'
import { PageHeading } from '@/components/public-page'
import { publicNumbers } from '@/server/public-settings'
import { HelpSearch, type Question } from './help-search'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Help | Maison d'Élites" }

// Questions and answers, search, and a contact link (01_PRODUCT.md 8.1). Numbers come from settings.
export default async function HelpPage() {
  const n = await publicNumbers()
  const b = brand()
  const questions: Question[] = [
    {
      topic: 'Getting started',
      q: 'Who can join?',
      a: 'Anyone with a public TikTok, Instagram, YouTube or X account. Some campaigns set a minimum number of followers or a minimum account age, and say so on the campaign page.',
    },
    {
      topic: 'Getting started',
      q: 'Does it cost anything to join?',
      a: 'No. Joining a campaign and posting are free. The only creator fee is the withdrawal fee on the fees page.',
    },
    {
      topic: 'Accounts',
      q: 'How do I link an account?',
      a: `Use the official login where it is available, or place the short code we give you in your profile bio and press Verify. You can link up to ${n.maxLinkedAccounts} accounts.`,
    },
    {
      topic: 'Posting',
      q: 'How soon after posting do I submit the link?',
      a: `Within ${n.maxPostAgeHours} hours of posting. Older posts are not accepted.`,
    },
    {
      topic: 'Posting',
      q: 'Why was my post rejected?',
      a: 'Every rejection shows a reason, such as a missing hashtag or a video that is too short. The rules for each campaign are all on its page before you join.',
    },
    {
      topic: 'Posting',
      q: 'Can I delete my post after it is approved?',
      a: `Keep it public for as long as the campaign page says. A post that is still missing or private after ${n.deletedPostGraceHours} hours is removed and its pending earnings are reversed. You can appeal if you think this is wrong.`,
    },
    {
      topic: 'Earnings',
      q: 'How are views counted?',
      a: 'We check views on a schedule and keep every check. A post earns the campaign rate for every 1,000 counted views once it passes the minimum views for that campaign, up to any caps.',
    },
    {
      topic: 'Earnings',
      q: 'When can I withdraw?',
      a: `Earnings become available ${n.availableWhen}. You can withdraw from ${n.withdrawalMin}.`,
    },
    {
      topic: 'Earnings',
      q: 'What does a withdrawal cost?',
      a: `Withdrawal fee: ${n.withdrawalFee}. The fee and the amount you receive are shown before you confirm, and a failed payout costs nothing.`,
    },
    {
      topic: 'Appeals',
      q: 'I think a decision is wrong. What can I do?',
      a: `Open an appeal from the submission. You can appeal a rejected or removed post once, and staff reply within ${n.appealReplyDays} business days.`,
    },
    {
      topic: 'Getting started',
      q: 'I am stuck. How do I get help?',
      a: `Open a ticket in our Discord${b.supportDiscordUrl ? '' : ' server'} and the team will reply there. You can also email ${b.contactEmail}.`,
    },
    {
      topic: 'Clients',
      q: 'I want to run a campaign. Where do I start?',
      a: 'Send an enquiry from the For clients page and we will reply by email.',
    },
  ]
  return (
    <>
      <PageHeading title="Questions," italic="answered." />
      {/* Kymen's request (2026-10-07): point anyone stuck to a Discord support ticket first. */}
      <section
        aria-label="Get help on Discord"
        className="mb-12 flex flex-wrap items-center justify-between gap-5 rounded-card border border-solid border-line bg-white px-7 py-6"
      >
        <div>
          <h2 className="m-0 font-sans text-[20px] font-semibold">Stuck? Open a ticket in our Discord.</h2>
          <p className="mt-2 mb-0 max-w-[560px] text-[15px] leading-[1.5] text-muted">
            Join the Maison d&apos;Élites Discord and open a ticket in the support channel. The team replies there.
          </p>
        </div>
        {b.supportDiscordUrl ? (
          <a
            href={b.supportDiscordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-pill bg-ink px-[22px] text-[14px] font-medium text-white no-underline hover:text-white"
          >
            Open a ticket on Discord <span aria-hidden>↗</span>
          </a>
        ) : null}
      </section>
      <HelpSearch questions={questions} contactEmail={b.contactEmail} supportHref={b.supportDiscordUrl ?? null} />
    </>
  )
}
