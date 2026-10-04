// Converts one screen of a locked handoff mockup (docs/design/handoff/*.dc.html) into a React
// component with exactly the same elements, inline styles and text, so the product renders the
// mockup pixel for pixel. It mirrors how the mockup runtime builds the page:
//  - style strings become style objects with the same kebab to camel rule,
//  - whitespace-only text that contains a space is kept, newline-only text is dropped,
//  - {{ expr }} reads from the screen's values object `v` (or the current loop item),
//  - <sc-if> and <sc-for> become conditionals and maps.
// Every static text node becomes a content slot `t('<page>.<n>')` so staff can edit the words
// from settings while the layout stays fixed. The approved text is written to <name>.content.ts.
//
// Usage: node scripts/dc-to-tsx.mjs <mockup file> <screen flag> <ComponentName> <content page> [replacements.json]
// Example: node scripts/dc-to-tsx.mjs "Creator Site v1.dc.html" isHome HomeDesign home
import fs from 'node:fs'
import path from 'node:path'
import { parseDocument } from 'htmlparser2'

const [, , file, flag, componentName, page, replacementsFile] = process.argv
if (!file || !flag || !componentName || !page) {
  console.error('Usage: node scripts/dc-to-tsx.mjs <mockup file> <screen flag> <ComponentName> <content page> [replacements.json]')
  process.exit(1)
}
const HANDOFF = path.resolve(import.meta.dirname, '../../../docs/design/handoff')
const OUT = path.resolve(import.meta.dirname, '../src/designed')
// Expressions to swap out, e.g. width-driven zoom values that become CSS variables.
const replacements = replacementsFile ? JSON.parse(fs.readFileSync(replacementsFile, 'utf8')) : {}
// Elements whose own text is listed under "$authoring" are the mockup's video-loading controls
// (file pickers and link prompts). Like image-slot.js they are preview tooling, not product, so
// they render only when v.authoring is true. Videos in the product come from settings.
const authoring = new Set(replacements.$authoring ?? [])
delete replacements.$authoring
// "$attach" adds behaviour to designed elements without touching their look, keyed by
// "<tag>:<the element's own text>", e.g. { "div:Book a call": { "onClick": "v.bookCall" } }.
// onClick goes through clickable(); other keys (like id) are added as plain attributes.
const attach = replacements.$attach ?? {}
delete replacements.$attach
const attachUsed = new Set()

const src = fs.readFileSync(path.join(HANDOFF, file), 'utf8')
const tpl = src.slice(src.indexOf('<x-dc>') + 6, src.lastIndexOf('</x-dc>'))
const doc = parseDocument(tpl, { lowerCaseTags: false, lowerCaseAttributeNames: false, recognizeSelfClosing: true, decodeEntities: true })

function find(node) {
  if (node.type === 'tag' && node.name === 'sc-if' && node.attribs.value?.replace(/[{}\s]/g, '') === flag) return node
  for (const c of node.children ?? []) {
    const f = find(c)
    if (f) return f
  }
  return null
}
const root = find(doc)
if (!root) throw new Error(`No <sc-if value="{{ ${flag} }}"> in ${file}`)

const content = {}
let slot = 0
const usedAssets = new Set()

const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

function expr(raw, scope) {
  const e = raw.trim()
  if (e in replacements) return replacements[e]
  const head = e.split('.')[0]
  return scope.has(head) ? e : `v.${e}`
}

// A string that may contain {{ }} becomes a JS expression.
function valueExpr(raw, scope) {
  const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/)
  if (whole) return expr(whole[1], scope)
  if (!raw.includes('{{')) return JSON.stringify(raw)
  const parts = raw.split(/\{\{([\s\S]+?)\}\}/g)
  return '`' + parts.map((p, i) => (i & 1 ? '${' + expr(p, scope) + '}' : p.replace(/[`\\$]/g, (m) => '\\' + m))).join('') + '`'
}

function asset(url) {
  if (url.startsWith('assets/')) {
    usedAssets.add(url)
    return '/designed/' + url.slice('assets/'.length)
  }
  return url
}

function styleExpr(raw, scope) {
  // Same parse as the mockup runtime: split on ';', first ':' separates the property.
  const entries = []
  for (const decl of raw.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const prop = decl.slice(0, i).trim()
    const key = prop.startsWith('--') ? prop : kebabToCamel(prop)
    entries.push(`${JSON.stringify(key)}: ${valueExpr(decl.slice(i + 1).trim(), scope)}`)
  }
  return `{css({ ${entries.join(', ')} })}`
}

const BOOLEAN = { autoplay: 'autoPlay', muted: 'muted', loop: 'loop', playsinline: 'playsInline', controls: 'controls' }

function attrs(node, scope) {
  const out = []
  const ownText = (node.children ?? []).filter((c) => c.type === 'text').map((c) => c.data).join('').trim()
  const extra = attach[`${node.name}:${ownText}`]
  if (extra) {
    attachUsed.add(`${node.name}:${ownText}`)
    for (const [k, v] of Object.entries(extra)) out.push(k === 'onClick' ? `{...clickable(${v})}` : `${k}=${JSON.stringify(v)}`)
  }
  for (const [name, value] of Object.entries(node.attribs)) {
    if (name === 'style') {
      out.push(`style=${styleExpr(value, scope)}`)
      continue
    }
    let key = name
    if (key === 'class') key = 'className'
    else if (key === 'for') key = 'htmlFor'
    else if (key in BOOLEAN) {
      out.push(BOOLEAN[key])
      continue
    } else if (key.includes('-') && !key.startsWith('data-') && !key.startsWith('aria-')) key = kebabToCamel(key)
    let v = valueExpr(value, scope)
    if ((key === 'src' || key === 'poster') && !value.includes('{{')) v = JSON.stringify(asset(value))
    if (key.startsWith('on')) {
      // Clickable non-button elements get keyboard access without any visual change.
      if (key === 'onClick' && !['button', 'a', 'label', 'input'].includes(node.name)) {
        out.push(`{...clickable(${v})}`)
        continue
      }
    }
    out.push(v.startsWith('"') ? `${key}=${v}` : `${key}={${v}}`)
  }
  return out.length ? ' ' + out.join(' ') : ''
}

function text(node, scope) {
  const txt = node.data
  if (!txt.includes('{{')) {
    if (!txt.trim()) return txt.includes(' ') ? "{' '}" : ''
    // Keep the exact leading and trailing whitespace around the slot.
    const lead = txt.match(/^\s*/)[0]
    const trail = txt.match(/\s*$/)[0]
    const key = `${page}.${String(++slot).padStart(3, '0')}`
    content[key] = txt.slice(lead.length, txt.length - trail.length)
    return (lead ? "{' '}" : '') + `{copy(${JSON.stringify(key)})}` + (trail ? "{' '}" : '')
  }
  const parts = txt.split(/\{\{([\s\S]+?)\}\}/g)
  return parts
    .map((p, i) => (i & 1 ? `{${expr(p, scope)}}` : p ? `{${JSON.stringify(p.replace(/\s+/g, ' '))}}` : ''))
    .join('')
}

function children(node, scope, depth) {
  return (node.children ?? []).map((c) => emit(c, scope, depth)).join('')
}

function emit(node, scope, depth) {
  if (node.type === 'text') return text(node, scope)
  if (node.type !== 'tag') return ''
  if (node.name === 'sc-if') {
    return `{${valueExpr(node.attribs.value, scope)} ? (<>${children(node, scope, depth)}</>) : null}`
  }
  if (node.name === 'sc-for') {
    const as = node.attribs.as || 'item'
    const inner = new Set(scope)
    inner.add(as)
    const idx = `i${depth}`
    return `{(${valueExpr(node.attribs.list, scope)} as any[]).map((${as}: any, ${idx}: number) => (<Fragment key={${idx}}>${children(node, inner, depth + 1)}</Fragment>))}`
  }
  if (node.name === 'image-slot') return '' // preview tool only (image-slot.js); never shipped
  const ownText = (node.children ?? []).filter((c) => c.type === 'text').map((c) => c.data).join('').trim()
  if (authoring.has(ownText)) {
    const saved = slot
    const savedContent = { ...content }
    const inner = emitTag(node, scope, depth)
    // Authoring controls are not product copy, so they do not get content slots.
    slot = saved
    for (const k of Object.keys(content)) if (!(k in savedContent)) delete content[k]
    return `{v.authoring ? (${inner.replace(/\{copy\("[^"]+"\)\}/g, JSON.stringify(ownText).replace(/^/, '{').replace(/$/, '}'))}) : null}`
  }
  return emitTag(node, scope, depth)
}

function emitTag(node, scope, depth) {
  const voidTags = new Set(['img', 'br', 'input', 'meta', 'link', 'hr', 'source'])
  if (voidTags.has(node.name)) return `<${node.name}${attrs(node, scope)} />`
  return `<${node.name}${attrs(node, scope)}>${children(node, scope, depth)}</${node.name}>`
}

const body = children(root, new Set(['copy']), 0)
for (const k of Object.keys(attach)) if (!attachUsed.has(k)) throw new Error(`$attach key matched nothing: ${k}`)
const name = componentName.replace(/Design$/, '').toLowerCase()
const header = `// GENERATED from docs/design/handoff/${file} (screen "${flag}") by apps/web/scripts/dc-to-tsx.mjs.
// This is the locked design. Do not restyle it. Wire behaviour through the values object \`v\`.
/* eslint-disable @typescript-eslint/no-explicit-any */
`
const tsx = `${header}import { Fragment } from 'react'
import { clickable, css } from './runtime'

export function ${componentName}({ v, copy }: { v: any; copy: (key: string) => string }) {
  return (<>${body}</>)
}
`
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, `${name}.tsx`), tsx)
fs.writeFileSync(
  path.join(OUT, `${name}.content.ts`),
  `// GENERATED approved copy for the "${page}" page, from docs/design/handoff/${file}.\n// Staff edits are stored in settings (content.${page}) and override these by key.\nexport const ${page}Content: Record<string, string> = ${JSON.stringify(content, null, 2)}\n`,
)
console.log(`Wrote ${name}.tsx with ${slot} text slots. Assets: ${[...usedAssets].join(', ')}`)
