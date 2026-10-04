import type { ReactNode } from 'react'

// The outer wrapper every mockup screen renders inside (same styles as the mockup root element).
export function DesignedFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F2EEE6', fontFamily: "'Archivo',system-ui,sans-serif", color: '#1A1510' }}>
      {children}
    </div>
  )
}
