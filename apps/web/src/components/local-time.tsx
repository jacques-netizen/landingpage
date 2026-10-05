'use client'

import { useEffect, useState } from 'react'

const utc = (d: Date) => `${d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })} UTC`
const local = (d: Date) => {
  const zone = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value
  return `${d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}${zone ? ` ${zone}` : ''}`
}

/** A date and time in the viewer's own time zone (05_DESIGN_SYSTEM.md section 9). UTC until the browser takes over. */
export function LocalDateTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => utc(new Date(iso)))
  useEffect(() => setText(local(new Date(iso))), [iso])
  return <time dateTime={iso}>{text}</time>
}
