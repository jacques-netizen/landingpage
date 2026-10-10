// Builds sample guides for six answer combinations with the rules writer and
// checks them against the acceptance rules: no em dashes, only approved
// proof figures and figures from the numbers model, 6 to 16 PDF pages.
// With --live and ANTHROPIC_API_KEY set, also writes three guides with the
// AI writer and saves their JSON and HTML for review.
// Usage: npx tsx --conditions=react-server scripts/sample-guides.ts [outDir] [--live] [--no-pdf]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";
import proofJson from "../content/proof.json";
import { briefFor } from "../src/lib/server/guide/brief";
import { composeDoc } from "../src/lib/server/guide/compose";
import { rulesGuide } from "../src/lib/server/guide/rules";
import { renderGuideHtml } from "../src/lib/server/guide/render";
import { htmlToPdf, pdfPageCount } from "../src/lib/server/guide/pdf";
import { writeWithAi } from "../src/lib/server/guide/writer";
import { guideText, type GuideDoc } from "../src/lib/guide/doc";
import { allowedFigures } from "../src/lib/guide/model";
import type { LeadRow } from "../src/lib/server/leads";

const MIN_PAGES = 6;
const MAX_PAGES = 16;
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) || ".data/samples";
const live = args.includes("--live");
const noPdf = args.includes("--no-pdf");
fs.mkdirSync(out, { recursive: true });

export function sampleLead(name: string, over: Partial<LeadRow>): LeadRow {
  return {
    id: `00000000-0000-4000-8000-${name.replace(/[^a-z0-9]/g, "").padEnd(12, "0").slice(0, 12)}`,
    sessionId: "22222222-2222-2222-2222-222222222222",
    firstName: "Sam",
    email: "sam@example.com",
    igHandle: null,
    company: null,
    consentTextVersion: "v",
    consentAt: new Date("2026-10-08"),
    qualified: true,
    humanPriority: false,
    path: "creator",
    variant: "full",
    answers: {},
    ghlContactId: null,
    ghlOpportunityId: null,
    metaEventId: "e",
    fbp: null,
    fbc: null,
    clientIp: null,
    userAgent: null,
    bookedAt: null,
    createdAt: new Date("2026-10-08"),
    ...over,
  };
}

export const cases: [string, LeadRow][] = [
  ["creator-music-visibility", sampleLead("creatormusic", { path: "creator", answers: { role: "creator", project: "my next single, Midnight", asset: "music_release", objective: "visibility", market: "Nigeria", audience: "18 to 25, into afrobeats", library: "some", reach: "1k_10k", platforms: ["tiktok", "instagram_reels"], timing: "this_month", budget: { band: "3k_10k" }, deciding: "no" } })],
  ["brand-product-conversions", sampleLead("brandproduct", { path: "brand", humanPriority: true, answers: { role: "brand", project: "a skincare launch", asset: "product_launch", objective: "conversions", action: "buy", market: "United Kingdom", audience: "women 25 to 40 who buy skincare online", library: "hours", reach: "10k_100k", platforms: ["instagram_reels", "x", "tiktok"], timing: "two_weeks", budget: { band: "10k_50k" }, deciding: "yes" } })],
  ["creator-personal-both-soft", sampleLead("creatorpersonal", { path: "creator", qualified: false, answers: { role: "creator", project: "my fitness coaching", asset: "personal_brand", objective: "both", action: "signup", market: "United States", audience: "men 20 to 35 starting the gym", library: "years", reach: "under_1k", platforms: ["tiktok"], timing: "exploring", budget: { band: "under_3k" }, deciding: "no" } })],
  ["brand-podcast-both", sampleLead("brandpodcast", { path: "brand", answers: { role: "brand", project: "our weekly football podcast", asset: "podcast_stream", objective: "both", action: "follow", market: "United Kingdom", audience: "football fans 18 to 34", library: "years", reach: "100k_plus", platforms: ["youtube_shorts", "tiktok"], timing: "next_quarter", budget: { band: "50k_plus" }, deciding: "no" } })],
  ["clipper-music-new", sampleLead("clippermusic", { path: "clipper", qualified: false, answers: { role: "clipper", asset: "music", accounts: "none", hours: "5_10", tools: "capcut", platforms: ["tiktok", "youtube_shorts"], goal: "side_income", timing: "new", first_niche: "afrobeats and amapiano" } })],
  ["clipper-sports-paid", sampleLead("clippersports", { path: "clipper", qualified: false, answers: { role: "clipper", asset: "sports", accounts: "10k_plus", hours: "20_plus", tools: "desktop", platforms: ["x", "instagram_reels"], goal: "full_time", timing: "paid", first_niche: "" } })],
];

const figure = /(\$\d[\d.,]*\d[KMB]?\+?|\$\d[KMB]?\+?|\b\d[\d.,]*[KMB]\+?(?=[\s<.,;:)]|$))/g;
const guideDir = path.join(process.cwd(), "content", "guide");
const exampleFigures = fs.readdirSync(guideDir).filter((f) => f.endsWith(".md")).flatMap((f) => (matter(fs.readFileSync(path.join(guideDir, f), "utf8")).data.examples as string[]) ?? []);
const proofFigures = (Object.values(proofJson.items) as { status: string }[]).filter((i) => i.status === "approved").flatMap((i) => JSON.stringify(i).match(figure) ?? []);

async function check(name: string, doc: GuideDoc): Promise<boolean> {
  const approved = new Set<string>([...exampleFigures, ...proofFigures, ...allowedFigures(doc.numbers)]);
  const text = guideText(doc);
  const dashes = text.includes(String.fromCharCode(0x2014));
  const figs = [...new Set(text.replace(/<[^>]+>/g, " ").match(figure) ?? [])].filter((f) => !approved.has(f));
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(doc, null, 2));
  const html = renderGuideHtml(doc, { asset: String(doc.facts.find((f) => f.id === "asset")?.answer ?? ""), date: new Date("2026-10-08") });
  fs.writeFileSync(path.join(out, `${name}.html`), html);
  let pages = 0;
  let blank: number[] = [];
  if (!noPdf) {
    const pdf = await htmlToPdf(html);
    fs.writeFileSync(path.join(out, `${name}.pdf`), pdf);
    pages = pdfPageCount(pdf);
    try {
      const txt = execFileSync("pdftotext", [path.join(out, `${name}.pdf`), "-"], { encoding: "utf8" });
      blank = txt.split("\f").slice(0, pages).map((t, i) => (t.trim().length < 5 ? i + 1 : 0)).filter(Boolean);
    } catch {
      /* poppler not installed */
    }
  }
  const pagesOk = noPdf || (pages >= MIN_PAGES && pages <= MAX_PAGES);
  const ok = pagesOk && !dashes && figs.length === 0 && blank.length === 0;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} [${doc.writer}${doc.model ? ` ${doc.model}` : ""}]: ${noPdf ? "" : `${pages} pages, `}${text.split(/\s+/).length} words, sections: ${doc.sections.map((s) => s.key).join(", ")}${dashes ? ", EM DASH" : ""}${blank.length ? `, blank pages: ${blank.join(" ")}` : ""}${figs.length ? `, unapproved figures: ${figs.join(" ")}` : ""}`);
  return ok;
}

async function main() {
  let failed = false;
  for (const [name, lead] of cases) {
    const brief = briefFor(lead);
    if (!(await check(name, rulesGuide(lead, brief)))) failed = true;
  }
  if (live) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("--live needs ANTHROPIC_API_KEY");
      process.exit(1);
    }
    for (const [name, lead] of cases.filter((_, i) => [0, 1, 4].includes(i))) {
      const brief = briefFor(lead);
      const started = Date.now();
      try {
        const r = await writeWithAi(brief);
        console.log(`     ${name}: written by ${r.model} in ${Math.round((Date.now() - started) / 1000)}s, ${r.usage.input} in / ${r.usage.output} out`);
        if (!(await check(`${name}-ai`, composeDoc(brief, r.written, { writer: "ai", model: r.model })))) failed = true;
      } catch (e) {
        failed = true;
        console.log(`FAIL ${name}-ai: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && process.argv[1].endsWith("sample-guides.ts")) void main();
