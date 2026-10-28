import { operations } from './openapi'

// The developer docs' sidebar, in reading order. The API reference part is built from the OpenAPI file.
export type NavItem = { title: string; href: string; method?: string }
export type NavGroup = { title: string; items: NavItem[] }

export function navGroups(): NavGroup[] {
  const ops = operations()
  const tags = [...new Set(ops.map((o) => o.tag))]
  return [
    {
      title: 'Get started',
      items: [
        { title: 'Introduction', href: '/developers' },
        { title: 'Quickstart', href: '/developers/quickstart' },
        { title: 'Authentication', href: '/developers/authentication' },
        { title: 'Sandbox', href: '/developers/sandbox' },
      ],
    },
    {
      title: 'Guides',
      items: [
        { title: 'Campaign stats', href: '/developers/guides/campaign-stats' },
        { title: 'Webhooks', href: '/developers/webhooks' },
        { title: 'Pagination', href: '/developers/pagination' },
        { title: 'Errors and limits', href: '/developers/errors' },
      ],
    },
    ...tags.map((tag) => ({
      title: tag,
      items: ops
        .filter((o) => o.tag === tag)
        .map((o) => ({ title: o.summary, href: `/developers/reference/${o.id}`, method: o.method })),
    })),
    {
      title: 'More',
      items: [
        { title: 'API reference', href: '/developers/reference' },
        { title: 'Changelog', href: '/developers/changelog' },
        { title: 'Get API access', href: '/developers/access' },
      ],
    },
  ]
}

/** The pages before and after one, for the links at the foot of each page. */
export function neighbours(href: string) {
  const flat = navGroups().flatMap((g) => g.items)
  const i = flat.findIndex((x) => x.href === href)
  return { prev: i > 0 ? flat[i - 1]! : null, next: i >= 0 && i < flat.length - 1 ? flat[i + 1]! : null }
}
