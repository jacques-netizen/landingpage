import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const appDir = join(__dirname, '..', 'app')

function files(dir: string, name: RegExp, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) files(p, name, out)
    else if (name.test(f)) out.push(p)
  }
  return out
}

/** Security test: no admin page or API route may exist without a server side guard. */
describe('admin route guards', () => {
  const pages = files(join(appDir, 'admin'), /^page\.tsx$/)
  const routes = files(join(appDir, 'api', 'v1', 'admin'), /^route\.ts$/)

  it('finds the admin routes', () => {
    expect(pages.length).toBeGreaterThan(0)
    expect(routes.length).toBeGreaterThan(0)
  })

  for (const p of pages) {
    it(`page ${relative(appDir, p)} calls requireStaffPage`, () => {
      expect(readFileSync(p, 'utf8')).toMatch(/requireStaffPage\(/)
    })
  }
  for (const r of routes) {
    it(`route ${relative(appDir, r)} wraps every handler in withStaff`, () => {
      const src = readFileSync(r, 'utf8')
      const exported = [
        ...src.matchAll(/export (?:const|async function|function) (GET|POST|PUT|PATCH|DELETE)\b/g),
      ]
      expect(exported.length).toBeGreaterThan(0)
      for (const m of exported) {
        const line = src.slice(m.index).split('\n')[0]!
        const body = src.slice(m.index, m.index + 400)
        expect(line + body, `${m[1]} in ${r}`).toMatch(/withStaff|notFound/)
      }
      expect(src).toMatch(/withStaff\(/)
    })
  }
})
