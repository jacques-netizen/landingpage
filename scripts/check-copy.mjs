// Fails when interface copy contains an em dash (docs/05_DESIGN_SYSTEM.md section 11).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['apps', 'packages']
const skip = new Set(['node_modules', '.next', 'dist', 'drizzle', 'AGENTS.md', 'CLAUDE.md'])
const exts = new Set(['.ts', '.tsx', '.md', '.mdx', '.json', '.html', '.css'])
const EM_DASH = String.fromCharCode(0x2014)
const bad = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p)
    else if (exts.has(name.slice(name.lastIndexOf('.')))) {
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.includes(EM_DASH)) bad.push(`${p}:${i + 1}`)
        })
    }
  }
}
for (const r of roots) walk(r)
if (bad.length) {
  console.error('Em dash found (not allowed in copy):\n' + bad.join('\n'))
  process.exit(1)
}
console.log('Copy check passed')
