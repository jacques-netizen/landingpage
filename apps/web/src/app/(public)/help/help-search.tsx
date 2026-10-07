'use client'

import { EmptyState, Input } from '@mde/ui'
import { useId, useState } from 'react'

export type Question = { topic: string; q: string; a: string }

export function HelpSearch({
  questions,
  contactEmail,
  supportHref,
}: {
  questions: Question[]
  contactEmail: string
  supportHref: string | null
}) {
  const [query, setQuery] = useState('')
  const id = useId()
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = questions.filter((x) => {
    const hay = `${x.topic} ${x.q} ${x.a}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  const topics = [...new Set(shown.map((x) => x.topic))]
  return (
    <div className="max-w-[860px]">
      <label htmlFor={id} className="sr-only">
        Search help
      </label>
      <Input
        id={id}
        type="search"
        placeholder="Search help"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-[480px]"
      />
      <div className="mt-12">
        {shown.length === 0 ? (
          <EmptyState title="No answers match." body="Try other words, or ask us directly." />
        ) : (
          topics.map((t) => (
            <section key={t} className="mb-12">
              <h2 className="m-0 mb-2 font-serif text-[32px] font-normal">{t}</h2>
              {shown
                .filter((x) => x.topic === t)
                .map((x) => (
                  <details
                    key={x.q}
                    className="border-0 border-t border-solid border-line py-5"
                    open={words.length > 0}
                  >
                    <summary className="cursor-pointer text-[17px] font-medium">{x.q}</summary>
                    <p className="mt-3 mb-0 max-w-[680px] text-[15px] leading-[1.6] text-muted">{x.a}</p>
                  </details>
                ))}
            </section>
          ))
        )}
      </div>
      <p className="mt-4 mb-0 border-0 border-t border-solid border-line pt-8 text-[15px]">
        Still stuck? Email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        {supportHref ? (
          <>
            {' '}
            or open a ticket in our <a href={supportHref}>Discord</a>
          </>
        ) : null}
        .
      </p>
    </div>
  )
}
