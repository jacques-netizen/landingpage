// Renders stored text: blank lines split paragraphs, lines starting "## " are headings, lines starting
// "- " are list items. Deliberately small; no HTML from stored text is ever rendered.
export function PlainText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return (
    <div className="max-w-[720px] text-[15px] leading-[1.6]">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines[0]!.startsWith('## '))
          return (
            <h2 key={i} className="mt-10 mb-3 font-serif text-[28px] leading-[1.1] font-normal first:mt-0">
              {lines[0]!.slice(3)}
            </h2>
          )
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <ul key={i} className="my-4 pl-5">
              {lines.map((l, j) => (
                <li key={j} className="mb-1">
                  {l.slice(2)}
                </li>
              ))}
            </ul>
          )
        return (
          <p key={i} className="my-4">
            {b}
          </p>
        )
      })}
    </div>
  )
}
