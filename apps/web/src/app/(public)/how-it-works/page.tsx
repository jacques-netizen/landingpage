import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeading } from '@/components/public-page'
import { publicNumbers } from '@/server/public-settings'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "How it works | Maison d'Élites" }

// Five short steps from sign-up to payout, with review and appeal included (01_PRODUCT.md 8.1).
export default async function HowItWorksPage() {
  const n = await publicNumbers()
  const steps = [
    {
      title: 'Sign up and link your accounts',
      body: `Create an account and confirm you are 18 or older. Link up to ${n.maxLinkedAccounts} TikTok, Instagram, YouTube or X accounts, with the official login where it is available or a short code in your profile bio.`,
    },
    {
      title: 'Pick a campaign',
      body: 'Every rule is on the campaign page before you join: the rate, the budget left, the caps, the minimum views and how long the post must stay up. Private campaigns ask for an access code.',
    },
    {
      title: 'Post and submit the link',
      body: `Post the video on your own account, then paste its link within ${n.maxPostAgeHours} hours. Automatic checks run at once, and if one fails you see the reason straight away.`,
    },
    {
      title: 'Review, and appeal if you disagree',
      body: `A reviewer checks every post. Views are counted on a schedule and your pending earnings update after each check. If a post is rejected or removed you can appeal once, and staff reply within ${n.appealReplyDays} business days.`,
    },
    {
      title: 'Get paid',
      body: `Earnings become available ${n.availableWhen}. Withdraw to your bank or PayPal from ${n.withdrawalMin}. The fee and the amount you receive are shown before you confirm.`,
    },
  ]
  return (
    <>
      <PageHeading
        title="From your first post"
        italic="to your first payout."
        lead="Five steps. No follower minimum unless a campaign sets one, and you never pay to join."
      />
      <ol className="m-0 grid max-w-[960px] list-none gap-0 p-0">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="grid grid-cols-[96px_1fr] gap-6 border-0 border-t border-solid border-line py-8 max-sm:grid-cols-[56px_1fr] max-sm:gap-4"
          >
            <span className="font-serif text-[56px] leading-none text-muted-2 max-sm:text-[40px]">{i + 1}</span>
            <div>
              <h2 className="m-0 font-serif text-[30px] leading-[1.1] font-normal">{s.title}</h2>
              <p className="mt-3 mb-0 max-w-[620px] text-[15px] leading-[1.6] text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-10 mb-0 text-[15px]">
        <Link href="/campaigns">See live campaigns</Link> <span className="text-muted-2">or read the</span>{' '}
        <Link href="/fees">fees</Link>
        <span className="text-muted-2">.</span>
      </p>
    </>
  )
}
