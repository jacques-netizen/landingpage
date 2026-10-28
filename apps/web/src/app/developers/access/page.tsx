import { contactEmail } from '@/developers/base'
import { Callout, H2, OL, P, Page } from '@/developers/ui'

export const metadata = { title: 'Get API access' }

export default function Access() {
  const email = contactEmail()
  const subject = encodeURIComponent('API access')
  return (
    <Page
      href="/developers/access"
      eyebrow="More"
      title="Get API access"
      lead="The documentation is open to everyone. Keys are issued to partners we work with."
    >
      <H2 id="how">How to get a key</H2>
      <OL>
        <li>
          {email ? (
            <>
              Email <a href={`mailto:${email}?subject=${subject}`}>{email}</a>
            </>
          ) : (
            'Write to your contact at Maison d’Élites'
          )}{' '}
          with your company, what you want to build, and which campaigns or clients it is for.
        </li>
        <li>We send you a sandbox key to build and test with.</li>
        <li>When your integration works, we send a live key for your campaigns.</li>
      </OL>
      <Callout>
        <P>
          We send keys privately and never by public message. If you think a key has leaked, tell us and we revoke it.
        </P>
      </Callout>
    </Page>
  )
}
