'use client'

import { usePathname } from 'next/navigation'
import type { NavGroup } from '@/developers/nav'

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname()
  return (
    <nav className="dx-side" aria-label="Documentation">
      {groups.map((g) => (
        <div key={g.title}>
          <h4>{g.title}</h4>
          <ul>
            {g.items.map((i) => (
              <li key={i.href}>
                <a href={i.href} aria-current={path === i.href ? 'page' : undefined}>
                  {i.method ? <span className={`dx-method ${i.method.toLowerCase()}`}>{i.method}</span> : null}
                  {i.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
