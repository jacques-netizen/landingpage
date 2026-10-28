import { apiUrl } from '@/developers/base'
import { operations } from '@/developers/openapi'
import { C, Code, H2, Method, P, Page } from '@/developers/ui'

export const metadata = { title: 'API reference' }

export default function Reference() {
  const ops = operations()
  const tags = [...new Set(ops.map((o) => o.tag))]
  return (
    <Page
      href="/developers/reference"
      eyebrow="API reference"
      title="API reference"
      lead="Every endpoint of the API. All answers are JSON; all requests need a key."
    >
      <Code title="Base URL" code={apiUrl()} />
      <P>
        The same reference as an OpenAPI 3.1 file: <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>. Import it
        into Postman, Insomnia or a client generator.
      </P>
      {tags.map((tag) => (
        <section key={tag}>
          <H2 id={tag.toLowerCase()}>{tag}</H2>
          <ul className="dx-reflist">
            {ops
              .filter((o) => o.tag === tag)
              .map((o) => (
                <li key={o.id}>
                  <a href={`/developers/reference/${o.id}`}>
                    <Method m={o.method} />
                    {o.summary}
                    <C>{o.path}</C>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </Page>
  )
}
