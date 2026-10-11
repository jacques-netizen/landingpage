import { Fragment } from 'react'
import { splitLinks } from '@/lib/linked-text-split'

export const LINK_CLASS =
  'font-medium text-[#1A5FD6] underline underline-offset-2 break-all hover:text-[#1247A8] [[data-theme=dark]_&]:text-[#7FB0FF] [[data-theme=dark]_&]:hover:text-[#A9C8FF]'

export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
            {p.text}
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  )
}
