import { extendTailwindMerge } from 'tailwind-merge'

// Teach the merger the custom radius and font tokens so later classes win over earlier ones.
const merge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['pill', 'chip', 'tile', 'input', 'card', 'float', 'panel'],
      font: ['serif', 'sans', 'app', 'mono'],
    },
  },
})

// Join class names, skipping empty values. Conflicting utilities resolve to the last one.
export function cn(...parts: Array<string | false | null | undefined>) {
  return merge(parts.filter(Boolean).join(' '))
}

// Two component families, both taken from the mockups:
// - paper: the light screens (public pages, client report, staff admin and review queue)
// - app: the creator app screens, themed Dark or Glass through [data-theme] CSS variables
export type Tone = 'paper' | 'app'

// No CSS reset is loaded (see DECISIONS.md), so native controls start from a clean slate here.
export const bare = 'm-0 appearance-none border-0 bg-transparent p-0 [font:inherit] text-inherit'

export const focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
