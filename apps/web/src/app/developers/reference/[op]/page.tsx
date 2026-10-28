import { notFound } from 'next/navigation'
import { apiUrl } from '@/developers/base'
import { operations } from '@/developers/openapi'
import { C, CodeBlock, H2, Md, P, Page, Table } from '@/developers/ui'

type Params = { params: Promise<{ op: string }> }

export function generateStaticParams() {
  return operations().map((o) => ({ op: o.id }))
}

export async function generateMetadata({ params }: Params) {
  const { op: id } = await params
  return { title: operations().find((o) => o.id === id)?.summary ?? 'API reference' }
}

const show = (v: unknown) => JSON.stringify(v, null, 2)

export default async function Operation({ params }: Params) {
  const { op: id } = await params
  const op = operations().find((o) => o.id === id)
  if (!op) notFound()
  const base = apiUrl()
  const example = op.path.replace(
    '{id}',
    op.path.startsWith('/webhooks') ? 'WEBHOOK_ID' : op.path.startsWith('/clips') ? 'CLIP_ID' : 'CAMPAIGN_ID',
  )
  const body = op.body ? JSON.stringify(op.body.example) : null
  const curl = [
    `curl${op.method === 'GET' ? '' : ` -X ${op.method}`} ${base}${example}`,
    '  -H "Authorization: Bearer $MDE_API_KEY"',
    ...(body ? ['  -H "Content-Type: application/json"', `  -d '${body}'`] : []),
  ].join(' \\\n')
  const js = `const res = await fetch('${base}${example}', {\n${op.method === 'GET' ? '' : `  method: '${op.method}',\n`}  headers: {\n    Authorization: \`Bearer \${process.env.MDE_API_KEY}\`,${body ? `\n    'Content-Type': 'application/json',` : ''}\n  },${body ? `\n  body: JSON.stringify(${body}),` : ''}\n})\nconst data = await res.json()`
  const py = `import os, requests\n\nres = requests.${op.method.toLowerCase()}(\n    "${base}${example}",\n    headers={"Authorization": f"Bearer {os.environ['MDE_API_KEY']}"},${body ? `\n    json=${body.replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')},` : ''}\n)\ndata = res.json()`
  const ok = op.responses.find((r) => r.status.startsWith('2'))
  const fail = op.responses.filter((r) => !r.status.startsWith('2'))
  return (
    <Page
      href={`/developers/reference/${op.id}`}
      eyebrow={op.tag}
      title={op.summary}
      lead={op.description ? <Md text={op.description} /> : undefined}
    >
      <div className="dx-endpoint">
        <span className={`dx-method ${op.method.toLowerCase()}`}>{op.method}</span>
        <span>{op.path}</span>
      </div>
      {op.parameters.length ? (
        <>
          <H2 id="parameters">Parameters</H2>
          <Table
            head={['Name', 'In', 'Type', 'Description']}
            rows={op.parameters.map((p) => [
              <C key="n">{p.name}</C>,
              p.in === 'path' ? 'path' : 'query',
              `${String((p.schema.enum as string[] | undefined)?.join(' | ') ?? p.schema.type)}${p.required ? ', required' : ''}${p.schema.default !== undefined ? `, default ${String(p.schema.default)}` : ''}`,
              <Md key="d" text={p.description} />,
            ])}
          />
        </>
      ) : null}
      {op.body ? (
        <>
          <H2 id="body">Body</H2>
          <Table
            head={['Field', 'Type', 'Description']}
            rows={Object.entries((op.body.schema.properties ?? {}) as Record<string, Record<string, unknown>>).map(
              ([name, s]) => [
                <C key="n">{name}</C>,
                s.type === 'array' ? 'list of event names' : String(s.type ?? ''),
                String(s.description ?? (name === 'events' ? 'The events to receive.' : '')),
              ],
            )}
          />
        </>
      ) : null}
      <H2 id="request">Request</H2>
      <CodeBlock
        tabs={[
          { label: 'cURL', code: curl },
          { label: 'JavaScript', code: js },
          { label: 'Python', code: py },
        ]}
      />
      {ok ? (
        <>
          <H2 id="response">Response</H2>
          <P>
            <C>{ok.status}</C> {ok.description}
          </P>
          <CodeBlock tabs={[{ label: `${ok.status} response`, code: show(ok.example) }]} />
        </>
      ) : null}
      {fail.length ? (
        <>
          <H2 id="errors">Errors</H2>
          <Table
            head={['Status', 'When']}
            rows={fail.map((r) => [<C key="s">{r.status}</C>, <Md key="d" text={r.description} />])}
          />
        </>
      ) : null}
    </Page>
  )
}
