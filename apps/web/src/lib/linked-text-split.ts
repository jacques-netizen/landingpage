// Web addresses inside stored text (a campaign brief, campaign rules) become links. Blue and
// underlined on purpose (owner request, 2026-10-11): clippers could not tell they were links.
// Only http and https addresses are linked; nothing else in the text is interpreted.
const URL_RE = /https?:\/\/[^\s<>"']+/g

/** The text split into plain parts and addresses, trailing punctuation left outside the link. */
export function splitLinks(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0]
    // A full stop, comma or bracket after an address is part of the sentence, not the link.
    const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    url = url.slice(0, url.length - trailing.length)
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: url, href: url })
    last = m.index + url.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

// A lighter blue on the Dark look so it still reads.
