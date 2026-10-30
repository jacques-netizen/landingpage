import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@/developers/docs.css'
import { navGroups } from '@/developers/nav'
import { SideNav } from './side-nav'

// The public developer docs (owner decision, 2026-10-28): how partners read campaign results through
// the API. Open to everyone; using the API needs a key from Maison d'Élites.
// Rendered per request: the pages read APP_URL and CONTACT_EMAIL, which only exist at runtime, so
// prerendering them during the Docker build fails the env check.
export const dynamic = 'force-dynamic'
  
export const metadata: Metadata = {
  title: { default: "Developers | Maison d'Élites", template: "%s | Maison d'Élites Developers" },
  description: "Build on Maison d'Élites: read campaign results, clip stats and reports, and get webhooks.",
}

export default function DevelopersLayout({ children }: { children: ReactNode }) {
  const groups = navGroups()
  return (
    <div className="dx">
      <header className="dx-top">
        <a href="/developers" className="dx-brand">
          <span className="m">
            Maison <b>d&apos;Élites</b>
          </span>
          <span className="d">Developers</span>
        </a>
        <nav className="dx-toplinks" aria-label="Developer links">
          <a href="/developers/reference">API reference</a>
          <a href="/developers/webhooks">Webhooks</a>
          <a href="/api/v1/openapi.json">OpenAPI</a>
          <a href="/developers/access" className="cta">
            Get API access
          </a>
        </nav>
      </header>
      <details className="dx-menu">
        <summary>Menu</summary>
        <SideNav groups={groups} />
      </details>
      <div className="dx-shell">
        <SideNav groups={groups} />
        <main className="dx-main">{children}</main>
      </div>
    </div>
  )
}
