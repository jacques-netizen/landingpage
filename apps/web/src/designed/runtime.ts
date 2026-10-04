import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'

type Handler = ((e: MouseEvent<HTMLElement>) => void) | undefined

// The mockups make plain elements clickable. This adds keyboard access (Enter and Space) and a
// role without changing how anything looks. Elements with no handler are left untouched.
export function clickable(handler: Handler) {
  if (!handler) return {}
  return {
    onClick: handler,
    role: 'link' as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).click()
      }
    },
  }
}

// Build the copy lookup: staff overrides from settings first, then the approved mockup text.
export function makeCopy(defaults: Record<string, string>, overrides: Record<string, string>) {
  return (key: string) => overrides[key] ?? defaults[key] ?? ''
}

// Mockup style objects include custom properties such as --r (used by the drift animation).
export const css = (style: Record<string, string>) => style as CSSProperties
