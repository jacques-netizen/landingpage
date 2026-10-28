import { C, Callout, H2, P, Page, UL } from '@/developers/ui'

export const metadata = { title: 'Sandbox' }

export default function Sandbox() {
  return (
    <Page
      href="/developers/sandbox"
      eyebrow="Get started"
      title="Sandbox"
      lead="Build and test against demo campaigns, with the same endpoints and the same answers as live."
    >
      <P>
        A sandbox key (<C>mde_test_...</C>) sees our demo campaigns: campaigns built from public clips that look and
        behave like real ones. Use it to build your integration end to end, webhooks included, before you get a live
        key.
      </P>
      <H2 id="same">What is the same</H2>
      <UL>
        <li>Every endpoint, parameter and field.</li>
        <li>Errors, pagination and rate limits.</li>
        <li>Webhook signatures and retries.</li>
      </UL>
      <H2 id="different">What is different</H2>
      <UL>
        <li>You only see demo campaigns, never a client&apos;s real campaign.</li>
        <li>
          <C>livemode</C> is <C>false</C> on <C>/me</C> and on every webhook event.
        </li>
        <li>Demo figures move rarely, so webhook events are fewer than on a live campaign.</li>
      </UL>
      <Callout>
        <P>
          Going live is a change of key, nothing else. Keep the key in configuration so the switch needs no code change.
        </P>
      </Callout>
    </Page>
  )
}
