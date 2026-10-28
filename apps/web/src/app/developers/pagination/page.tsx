import { apiUrl } from '@/developers/base'
import { C, CodeBlock, H2, P, Page } from '@/developers/ui'

export const metadata = { title: 'Pagination' }

export default function Pagination() {
  const base = apiUrl()
  return (
    <Page
      href="/developers/pagination"
      eyebrow="Guides"
      title="Pagination"
      lead="Lists come a page at a time, with a cursor to the next page."
    >
      <P>
        List endpoints take <C>limit</C> (1 to 100, 25 by default) and <C>cursor</C>. They answer with the page in{' '}
        <C>data</C>, <C>has_more</C>, and <C>next_cursor</C> to pass as <C>cursor</C> for the next page. Cursors stay
        valid while new items arrive, so you never skip or repeat an item.
      </P>
      <CodeBlock
        tabs={[
          {
            label: 'Response',
            code: `{\n  "object": "list",\n  "data": [ ... ],\n  "has_more": true,\n  "next_cursor": "MjAyNi0xMC0yNlQxMDowMDowMC4wMDBafDNmNmMy..."\n}`,
          },
        ]}
      />
      <H2 id="all">Reading every page</H2>
      <CodeBlock
        tabs={[
          {
            label: 'JavaScript',
            code: `async function allClips(campaignId) {\n  const clips = []\n  let cursor = null\n  do {\n    const url = new URL(\`${base}/campaigns/\${campaignId}/clips\`)\n    url.searchParams.set('limit', '100')\n    if (cursor) url.searchParams.set('cursor', cursor)\n    const page = await fetch(url, {\n      headers: { Authorization: \`Bearer \${process.env.MDE_API_KEY}\` },\n    }).then((r) => r.json())\n    clips.push(...page.data)\n    cursor = page.next_cursor\n  } while (cursor)\n  return clips\n}`,
          },
          {
            label: 'Python',
            code: `import os, requests\n\ndef all_clips(campaign_id):\n    headers = {"Authorization": f"Bearer {os.environ['MDE_API_KEY']}"}\n    clips, cursor = [], None\n    while True:\n        params = {"limit": 100, **({"cursor": cursor} if cursor else {})}\n        page = requests.get(f"${base}/campaigns/{campaign_id}/clips", params=params, headers=headers).json()\n        clips += page["data"]\n        cursor = page["next_cursor"]\n        if not cursor:\n            return clips`,
          },
        ]}
      />
    </Page>
  )
}
