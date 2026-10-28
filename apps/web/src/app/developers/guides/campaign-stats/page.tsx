import { apiUrl } from '@/developers/base'
import { C, CodeBlock, H2, P, Page, Table } from '@/developers/ui'

export const metadata = { title: 'Campaign stats' }

export default function CampaignStats() {
  const base = apiUrl()
  return (
    <Page
      href="/developers/guides/campaign-stats"
      eyebrow="Guides"
      title="Campaign stats"
      lead="What each number means, and how to build a campaign dashboard from them."
    >
      <H2 id="counting">How numbers are counted</H2>
      <P>
        Every clip is checked before it counts. A campaign&apos;s totals add up its approved clips, each at its newest
        figures. Clips still being checked are listed with <C>status: in_review</C> but are not in the totals. Rejected
        and removed clips never appear.
      </P>
      <Table
        head={['Field', 'Meaning']}
        rows={[
          [<C key="1">stats.views</C>, 'Views on approved clips.'],
          [<C key="2">stats.likes, comments</C>, 'Likes and comments on approved clips.'],
          [
            <C key="3">stats.shares</C>,
            'Shares on approved clips. Null when no platform in the campaign gives shares.',
          ],
          [<C key="4">stats.engagement_rate</C>, 'Likes, comments and shares over views, in percent.'],
          [<C key="5">stats.pages</C>, 'Accounts posting: with an approved clip or one being checked.'],
          [<C key="6">stats.budget_delivered_percent</C>, "The share of the campaign's budget delivered so far."],
        ]}
      />
      <H2 id="dashboard">A small dashboard</H2>
      <P>Totals from the campaign, a chart from the daily views, and the top clips from the clip list.</P>
      <CodeBlock
        tabs={[
          {
            label: 'JavaScript',
            code: `const api = (path) =>\n  fetch(\`${base}\${path}\`, {\n    headers: { Authorization: \`Bearer \${process.env.MDE_API_KEY}\` },\n  }).then((r) => r.json())\n\nconst id = 'CAMPAIGN_ID'\nconst [campaign, daily, clips] = await Promise.all([\n  api(\`/campaigns/\${id}\`),\n  api(\`/campaigns/\${id}/daily\`),\n  api(\`/campaigns/\${id}/clips?status=approved&limit=100\`),\n])\n\nconsole.log(campaign.title, campaign.stats.views, 'views')\nconsole.log(daily.data.map((d) => [d.date, d.views]))\nconst top = [...clips.data].sort((a, b) => b.stats.views - a.stats.views).slice(0, 6)\nconsole.log(top.map((c) => [c.page.handle, c.stats.views, c.url]))`,
          },
        ]}
      />
      <H2 id="reports">Reports</H2>
      <P>
        When we publish a client report for a campaign,{' '}
        <a href="/developers/reference/listReports">List a campaign&apos;s reports</a> gives its web address and PDF.
        Both open without a login, so you can link to them or attach the PDF.
      </P>
    </Page>
  )
}
