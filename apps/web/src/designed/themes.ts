// The app screens' Dark and Glass themes, exactly as the mockups' script defines them (object T).
// Dark is the default, as in the mockups.
export type ThemeName = 'dark' | 'light'
export const THEME_COOKIE = 'mde_theme'

export const THEMES = {
  dark: {
    stage: '#111117',
    stageLine: 'rgba(255,255,255,0.04)',
    card: '#1C1C24',
    cardLine: 'rgba(255,255,255,0.06)',
    text: '#F4F1EA',
    muted: 'rgba(244,241,234,0.64)',
    hair: 'rgba(255,255,255,0.08)',
    soft: 'rgba(255,255,255,0.1)',
    hair2: 'rgba(255,255,255,0.14)',
    rowBg: 'linear-gradient(90deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))',
    pop: '#26242a',
    accentInk: '#D8C58F',
    pageW: '#F2EEE6',
    bPage:
      'radial-gradient(900px 600px at 12% 0%,rgba(120,84,210,0.38),transparent 60%),radial-gradient(800px 600px at 92% 100%,rgba(216,170,90,0.24),transparent 60%),#0c0a12',
    gBg: 'rgba(255,255,255,0.06)',
    gLine: 'rgba(255,255,255,0.12)',
    side: 'rgba(10,8,16,0.55)',
    logoFilter: 'brightness(0) invert(1)',
    btn: '#F4F1EA',
    btnText: '#1A1510',
  },
  light: {
    stage: 'linear-gradient(135deg,rgba(255,255,255,0.62),rgba(255,255,255,0.28))',
    stageLine: 'rgba(255,255,255,0.9)',
    card: 'rgba(255,255,255,0.58)',
    cardLine: 'rgba(255,255,255,0.95)',
    text: '#17151C',
    muted: 'rgba(23,21,28,0.66)',
    hair: 'rgba(23,21,28,0.1)',
    soft: 'rgba(23,21,28,0.09)',
    hair2: 'rgba(23,21,28,0.18)',
    rowBg: 'rgba(23,21,28,0.045)',
    pop: 'rgba(255,255,255,0.85)',
    accentInk: '#86661F',
    pageW:
      'radial-gradient(900px 600px at 8% 0%,rgba(190,170,255,0.55),transparent 60%),radial-gradient(800px 600px at 96% 100%,rgba(255,200,160,0.55),transparent 60%),radial-gradient(700px 500px at 60% 35%,rgba(170,220,255,0.5),transparent 70%),#E8EAF2',
    bPage:
      'radial-gradient(900px 600px at 8% 0%,rgba(190,170,255,0.6),transparent 60%),radial-gradient(800px 600px at 96% 100%,rgba(255,200,160,0.6),transparent 60%),radial-gradient(700px 500px at 60% 35%,rgba(170,220,255,0.55),transparent 70%),#E8EAF2',
    gBg: 'rgba(255,255,255,0.55)',
    gLine: 'rgba(255,255,255,0.95)',
    side: 'rgba(255,255,255,0.5)',
    logoFilter: 'none',
    btn: '#17151C',
    btnText: '#FFFFFF',
  },
} as const

export type Theme = (typeof THEMES)[ThemeName]

/** The mockups' Dark / Glass switch. */
export function themeSwitch(current: ThemeName, set: (t: ThemeName) => void) {
  const dk = current === 'dark'
  return (
    [
      ['dark', 'Dark'],
      ['light', 'Glass'],
    ] as const
  ).map(([k, label]) => ({
    label,
    go: () => set(k),
    bg: current === k ? (dk ? '#D8C58F' : '#17151C') : 'transparent',
    fg: current === k ? (dk ? '#1A1510' : '#FFFFFF') : '#6E675C',
  }))
}

export function readThemeCookie(value: string | undefined): ThemeName {
  return value === 'light' ? 'light' : 'dark'
}

export function saveThemeCookie(t: ThemeName) {
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`
}
