import type { ReactNode } from 'react'
import { CodeBlock } from './code-block'
import { neighbours } from './nav'

// Building blocks of the developer docs pages.

export function Page({
  href,
  eyebrow,
  title,
  lead,
  children,
}: {
  href: string
  eyebrow?: string
  title: string
  lead?: ReactNode
  children: ReactNode
}) {
  const { prev, next } = neighbours(href)
  return (
    <article className="dx-article">
      {eyebrow ? <p className="dx-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
      {children}
      <nav className="dx-pager" aria-label="Pages">
        {prev ? (
          <a href={prev.href}>
            <small>Previous</small>
            {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={next.href} className="n">
            <small>Next</small>
            {next.title}
          </a>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}

export const H2 = ({ id, children }: { id: string; children: ReactNode }) => <h2 id={id}>{children}</h2>
export const H3 = ({ id, children }: { id?: string; children: ReactNode }) => <h3 id={id}>{children}</h3>
export const P = ({ children }: { children: ReactNode }) => <p>{children}</p>
export const C = ({ children }: { children: ReactNode }) => <code>{children}</code>

/** Text from the OpenAPI file, with its `code` marks shown as code. */
export function Md({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(`[^`]+`)/)
        .map((part, i) =>
          part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
        )}
    </>
  )
}
export const UL = ({ children }: { children: ReactNode }) => <ul className="dx-list">{children}</ul>
export const OL = ({ children }: { children: ReactNode }) => <ol className="dx-list">{children}</ol>

export function Callout({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return <div className={`dx-callout${warn ? ' warn' : ''}`}>{children}</div>
}

export function Cards({ items }: { items: { title: string; text: string; href: string }[] }) {
  return (
    <div className="dx-cards">
      {items.map((c) => (
        <a key={c.href} href={c.href} className="dx-card">
          <b>{c.title}</b>
          <span>{c.text}</span>
        </a>
      ))}
    </div>
  )
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="dx-tablewrap">
      <table className="dx-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const Method = ({ m }: { m: string }) => <span className={`dx-method ${m.toLowerCase()}`}>{m}</span>

export function Code({ title, code, lang }: { title?: string; code: string; lang?: string }) {
  return <CodeBlock tabs={[{ label: title ?? lang ?? 'Code', code }]} />
}

export { CodeBlock }
