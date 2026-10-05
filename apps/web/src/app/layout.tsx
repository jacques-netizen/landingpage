import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: "Maison d'Élites",
  description: 'Join a campaign, post on your own account, and earn for every view that counts.',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

// The mockups scale the 1440 px hero and the network wall by window width. Setting the same
// values as CSS variables before first paint keeps server rendering identical without a flash.
// Under 640px the wall uses the full column width (proposed phone layout, see designed/phone.css).
const scaleScript = `(function(){function u(){var w=window.innerWidth,s=document.documentElement.style;s.setProperty('--mde-hero-zoom',String(Math.min(1,w/1440)));s.setProperty('--mde-wall-scale',String(w<640?Math.min(1,(w-34)/660):Math.min(1,((Math.min(w,1240)-112)/2.05)/660)));s.setProperty('--mde-app-zoom',String(Math.min(1,(w-48)/1240)))}u();window.addEventListener('resize',u)})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the scale script sets CSS variables on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scaleScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
