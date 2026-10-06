import type { LegalSlug } from '@mde/db'

// Working text shown until the lawyer's text is saved as a version in legal_documents. Each page says
// plainly that it is working text. Nothing here is the final legal wording.
export const LEGAL_WORKING_TEXT: Record<LegalSlug, { title: string; body: string }> = {
  terms: {
    title: 'Creator Terms of Use',
    body: `## Who can use the platform
You must be 18 or older and the owner of every social account you link.

## Campaigns
Each campaign page lists its rules before you join. By joining you agree to those rules, saved as a dated version.

## Earnings
Earnings are calculated from counted views at the campaign rate, within its caps and budget. Posts that break the rules earn nothing and pending earnings on them can be reversed.

## Withdrawals
You can withdraw available earnings to a payout method in your name once you pass the identity check. Fees are listed on the fees page.

## Appeals
You can appeal a rejected or removed submission once.`,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `## What we collect
Your email address, the social accounts you link and their public statistics, your submissions, and the payout details you give us.

## Why
To run campaigns, count views, pay you, prevent fraud and meet legal duties.

## Who we share it with
Payout partners and identity check providers, only as needed to pay you. Clients see masked names unless you choose otherwise.

## Your choices
You can change your email preferences at any time and ask us to export or delete your data.`,
  },
  'campaign-rules': {
    title: 'Campaign Rules',
    body: `## Rules that apply to every campaign
- Post only on accounts you own and have linked.
- Do not buy views, likes or followers, or use bots.
- Keep each post public for as long as the campaign page says.
- Include every hashtag the campaign requires.

Each campaign adds its own rules on its page.`,
  },
  cookies: {
    title: 'Cookie Notice',
    body: `## Cookies we use
- A session cookie that keeps you signed in.
- A short-lived cookie that carries your sign-up choices to your new account.
- A cookie that remembers the theme you picked on the campaigns screen.

We do not use advertising cookies.`,
  },
  'brand-terms': {
    title: 'Brand Terms of Use',
    body: `## Campaigns
We agree each campaign's brief, rules and budget with you before it starts.

## Payment
You pay the budget and the agreed service fee before the campaign goes live. The budget is paid to creators for counted views.

## Unused budget
Budget not earned by creators when the campaign closes is refunded or credited to you.

## Reporting
You receive a private report link showing spend, views and posts.`,
  },
}
