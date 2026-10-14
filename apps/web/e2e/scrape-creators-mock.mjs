// A stand-in for the data provider's search endpoints, for the demo builder's end to end test. It
// answers in the shapes of the provider's own published examples (e2e/fixtures/scrape-creators), with
// posts about the demo's subject posted inside its window, and counts the credits it charges.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'scrape-creators')
const load = (n) => JSON.parse(fs.readFileSync(path.join(dir, `${n}.json`), 'utf8'))
const tiktok = load('tiktok-search')
const reels = load('instagram-reels-search')
const post = load('instagram-post')
const x = load('twitter-search')
let credits = 0
const base = Date.parse('2025-09-15T15:00:00Z') / 1000
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const q = url.searchParams.get('query') ?? ''
  const send = (body) => {
    credits++
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ...body, credits_remaining: 25000 - credits, credits_charged: 1 }))
  }
  if (url.pathname === '/credits') return res.end(String(credits))
  if (url.pathname === '/v1/tiktok/search/keyword') {
    const cursor = Number(url.searchParams.get('cursor') ?? 0)
    const t = tiktok.search_item_list[0]
    const items = Array.from({ length: 6 }, (_, i) => {
      const id = String(7500000000000000000n + BigInt(hash(q) % 100000) * 100n + BigInt(cursor * 10 + i))
      return {
        ...t,
        aweme_id: id,
        desc: `Mamdani on the subway ${q} ${i}`,
        create_time: base + (hash(q) % 50) * 86400 + i * 3600,
        author: { ...t.author, unique_id: `ttclipper${(hash(q) + i) % 40}`, nickname: `Clipper ${(hash(q) + i) % 40}` },
        statistics: {
          ...t.statistics,
          play_count: 6000 + (((hash(q) + cursor) * 7919 + i * 104729) % 260000) * (i === 0 && cursor === 0 ? 4 : 1),
          digg_count: 15000,
          comment_count: 420,
        },
      }
    })
    return send({ search_item_list: items, cursor: cursor + 6, has_more: cursor < 12 })
  }
  if (url.pathname === '/v2/instagram/reels/search') {
    const page = Number(url.searchParams.get('page') ?? 1)
    const r = reels.reels[0]
    const items = Array.from({ length: 4 }, (_, i) => ({
      ...r,
      shortcode: `DM${hash(q) % 9999}p${page}r${i}`,
      caption: `Zohran Mamdani rally clip ${i}`,
      taken_at: new Date((base + i * 86400 * 3) * 1000).toISOString(),
      like_count: 5000 + i,
      owner: { ...r.owner, username: `igclipper${(hash(q) + i) % 30}`, full_name: `IG Clipper ${i}` },
    }))
    return send({ reels: items })
  }
  if (url.pathname === '/v1/instagram/post') {
    const code = (url.searchParams.get('url') ?? '').match(/reel\/([^/]+)/)?.[1] ?? 'X'
    const m = post.data.xdt_shortcode_media
    return send({
      data: {
        xdt_shortcode_media: {
          ...m,
          shortcode: code,
          video_play_count: 8000 + (hash(code) % 240000),
          taken_at_timestamp: base + (hash(code) % 40) * 86400,
          owner: { ...m.owner, username: `igclipper${hash(code) % 30}`, full_name: 'IG Clipper' },
          edge_media_to_caption: { edges: [{ node: { text: 'Zohran Mamdani rally clip' } }] },
        },
      },
    })
  }
  if (url.pathname === '/v1/twitter/search/posts') {
    const p = x.posts[0]
    const posts = Array.from({ length: 3 }, (_, i) => {
      const id = String(1960000000000000000n + BigInt(hash(q) % 10000) * 10n + BigInt(i))
      return {
        ...p,
        rest_id: id,
        url: `https://x.com/xclipper${i}/status/${id}`,
        views: { count: String(20000 + ((hash(q) + i) % 90000)), state: 'EnabledWithCount' },
        legacy: {
          ...p.legacy,
          full_text: `Mamdani clip ${i}`,
          created_at: new Date((base + i * 86400) * 1000).toUTCString(),
        },
      }
    })
    return send({ posts, cursor: null })
  }
  if (url.pathname === '/v1/twitter/tweet') {
    const id = (url.searchParams.get('url') ?? '').match(/status\/(\d+)/)?.[1]
    return send({
      tweet: {
        rest_id: id,
        views: { count: '81000' },
        core: { user_results: { result: { core: { name: 'X Clipper', screen_name: 'xclipper' } } } },
        legacy: {
          favorite_count: 900,
          reply_count: 40,
          extended_entities: {
            media: [{ type: 'video', media_url_https: 'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/x.jpg' }],
          },
        },
      },
    })
  }
  res.writeHead(404)
  res.end('{}')
})
server.listen(Number(process.env.PORT ?? 3198))
