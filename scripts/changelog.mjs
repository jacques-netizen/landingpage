// Brings CHANGELOG.md up to date from git (owner, 2026-11-09: "track what changes are being made to the
// platform and where they came from"). Every commit becomes one line: what changed, who asked for it,
// who made it, and the commit. Lines already in the file are kept as they are (people may have
// corrected them), so a shallow clone with only recent history never drops older entries.
//
// Run after committing a change, then commit CHANGELOG.md as "Update the change log":
//   pnpm changelog
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'CHANGELOG.md')
const SKIP = /^(Update the change log|Merge (pull request|branch|remote-tracking))/
const HEAD = `# Change log

Every change to the platform's code, newest first: what changed, who asked for it, who made it, and the
commit. Built from git by \`pnpm changelog\` (scripts/changelog.mjs); run it after each commit and commit
this file as "Update the change log". Fix a line by hand if it is wrong; the script keeps edited lines.
Changes staff make to live data (money, decisions, users) are in the admin's Audit log instead.

Who made it: "Claude Code session …xxxxxx" is the Claude Code session that wrote the commit (its full
link is in the commit's Claude-Session trailer); a GitHub name is a person committing directly. Who
asked: the commit's Requested-by trailer, "not recorded" for changes made before 2026-11-09.
`

const SEP = '\u001e'
const FIELD = '\u001f'
const log = execFileSync(
  'git',
  [
    'log',
    '--no-merges',
    `--format=%H${FIELD}%ad${FIELD}%an${FIELD}%s${FIELD}%(trailers:key=Requested-by,valueonly,separator=%x2C )${FIELD}%(trailers:key=Made-by,valueonly,separator=%x2C )${FIELD}%(trailers:key=Claude-Session,valueonly,separator=)${SEP}`,
    '--date=short',
  ],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)

const clean = (s) => s.replace(/\s+/g, ' ').replace(/·/g, '-').trim()
const commits = log
  .split(SEP)
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => {
    const [hash, date, author, subject, requested, made, session] = r.split(FIELD)
    const sessionId = (session ?? '').trim().match(/session_([A-Za-z0-9]+)/)?.[1]
    const madeBy = clean(made ?? '') ||
      (sessionId ? `Claude Code session …${sessionId.slice(-6)}` : author === 'Claude' ? 'Claude Code' : clean(author ?? ''))
    return {
      hash: hash.trim(),
      date: date.trim(),
      line: `- ${clean(subject)} · Requested by: ${clean(requested ?? '') || 'not recorded'} · Made by: ${madeBy} · ${hash.trim().slice(0, 7)}`,
      subject,
    }
  })
  .filter((c) => !SKIP.test(c.subject))

// Entries already in the file, by date, keyed by their short commit at the end of the line.
const kept = new Map()
const known = new Set()
if (existsSync(FILE)) {
  let date = null
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    const d = line.match(/^## (\d{4}-\d{2}-\d{2})$/)
    if (d) {
      date = d[1]
      continue
    }
    const sha = line.match(/· ([0-9a-f]{7})$/)?.[1]
    if (date && line.startsWith('- ') && sha) {
      if (!kept.has(date)) kept.set(date, [])
      kept.get(date).push(line)
      known.add(sha)
    }
  }
}

let added = 0
// git log is newest first; new lines go above older ones on the same day.
const fresh = new Map()
for (const c of commits) {
  if (known.has(c.hash.slice(0, 7))) continue
  if (!fresh.has(c.date)) fresh.set(c.date, [])
  fresh.get(c.date).push(c.line)
  added++
}
const days = [...new Set([...fresh.keys(), ...kept.keys()])].sort().reverse()
const body = days.map((d) => `## ${d}\n\n${[...(fresh.get(d) ?? []), ...(kept.get(d) ?? [])].join('\n')}\n`).join('\n')
writeFileSync(FILE, `${HEAD}\n${body}`)
console.log(`CHANGELOG.md: ${added} new ${added === 1 ? 'entry' : 'entries'}`)
