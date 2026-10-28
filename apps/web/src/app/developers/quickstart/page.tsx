import { apiUrl } from '@/developers/base'
import { C, Callout, CodeBlock, H2, P, Page } from '@/developers/ui'

export const metadata = { title: 'Quickstart' }

export default function Quickstart() {
  const base = apiUrl()
  return (
    <Page
      href="/developers/quickstart"
      eyebrow="Get started"
      title="Quickstart"
      lead="From a key to your first campaign's numbers in three steps."
    >
      <H2 id="key">1. Get a key</H2>
      <P>
        Keys are issued by Maison d&apos;Élites. <a href="/developers/access">Ask for access</a> and you will get a
        sandbox key (<C>mde_test_...</C>) to build with, then a live key (<C>mde_live_...</C>) when you are ready. Keep
        keys on your server: never put one in a browser or an app.
      </P>
      <CodeBlock tabs={[{ label: 'Terminal', code: `export MDE_API_KEY="mde_test_..."` }]} />
      <H2 id="first">2. Check the key</H2>
      <P>Ask the API who you are. A working key answers with its partner name and mode.</P>
      <CodeBlock
        tabs={[
          { label: 'cURL', code: `curl ${base}/me \\\n  -H "Authorization: Bearer $MDE_API_KEY"` },
          {
            label: 'JavaScript',
            code: `const res = await fetch('${base}/me', {\n  headers: { Authorization: \`Bearer \${process.env.MDE_API_KEY}\` },\n})\nconsole.log(await res.json())`,
          },
          {
            label: 'Python',
            code: `import os, requests\n\nres = requests.get(\n    "${base}/me",\n    headers={"Authorization": f"Bearer {os.environ['MDE_API_KEY']}"},\n)\nprint(res.json())`,
          },
        ]}
      />
      <H2 id="campaigns">3. Read your campaigns</H2>
      <P>List the campaigns the key can see, then open one for its totals.</P>
      <CodeBlock
        tabs={[
          {
            label: 'cURL',
            code: `curl "${base}/campaigns?status=live" \\\n  -H "Authorization: Bearer $MDE_API_KEY"`,
          },
          {
            label: 'JavaScript',
            code: `const api = (path) =>\n  fetch(\`${base}\${path}\`, {\n    headers: { Authorization: \`Bearer \${process.env.MDE_API_KEY}\` },\n  }).then((r) => r.json())\n\nconst { data: campaigns } = await api('/campaigns?status=live')\nfor (const c of campaigns) {\n  console.log(c.title, c.stats.views, 'views')\n}`,
          },
          {
            label: 'Python',
            code: `import os, requests\n\nheaders = {"Authorization": f"Bearer {os.environ['MDE_API_KEY']}"}\ncampaigns = requests.get("${base}/campaigns", params={"status": "live"}, headers=headers).json()["data"]\nfor c in campaigns:\n    print(c["title"], c["stats"]["views"], "views")`,
          },
        ]}
      />
      <Callout>
        <P>
          With a sandbox key you get our demo campaigns: real-looking clips and figures that never change anything.
          Switch to the live key and the same code reads your real campaigns.
        </P>
      </Callout>
      <H2 id="then">Then</H2>
      <P>
        Pull every clip with <a href="/developers/reference/listClips">List a campaign&apos;s clips</a>, chart views
        with <a href="/developers/reference/getCampaignDaily">Get views per day</a>, and stop polling with{' '}
        <a href="/developers/webhooks">webhooks</a>.
      </P>
    </Page>
  )
}
