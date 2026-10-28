'use client'

import { useState } from 'react'

// A code sample with a copy button, and tabs when it comes in several languages.
export function CodeBlock({ tabs }: { tabs: { label: string; code: string }[] }) {
  const [i, setI] = useState(0)
  const [copied, setCopied] = useState(false)
  const tab = tabs[i] ?? tabs[0]!
  return (
    <div className="dx-code">
      <div className="bar">
        {tabs.length > 1 ? (
          <div className="dx-tabs" role="tablist">
            {tabs.map((t, j) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={j === i}
                onClick={() => {
                  setI(j)
                  setCopied(false)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span>{tab.label}</span>
        )}
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(tab.code).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code style={{ background: 'none', border: 0, padding: 0, color: 'inherit' }}>{tab.code}</code>
      </pre>
    </div>
  )
}
