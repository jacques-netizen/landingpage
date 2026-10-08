// Builds sample guides for six answer combinations and checks them against
// the Phase 3 acceptance rules: 4 to 6 pages, no em dashes, only approved
// proof figures. Usage: npx tsx --conditions=react-server scripts/sample-guides.ts [outDir]
import fs from "node:fs";
import path from "node:path";
import { assembleGuide, type GuideInput } from "../src/lib/server/guide/assemble";
import { renderGuideHtml } from "../src/lib/server/guide/render";
import { execFileSync } from "node:child_process";
import { htmlToPdf, pdfPageCount } from "../src/lib/server/guide/pdf";
import proofJson from "../content/proof.json";

const out = process.argv[2] || ".data/samples";
fs.mkdirSync(out, { recursive: true });

const base = { firstName: "Sam", bookingUrl: "https://cal.com/maisondelites/discovery?name=Sam", joinUrl: "https://whop.com/maison-delites" };
const cases: [string, GuideInput][] = [
  ["creator-music-qualified", { ...base, path: "creator", qualified: true, answers: { role: "creator", asset: "music_release", platforms: ["tiktok", "instagram_reels"], goal: "streams", timing: "this_month", budget: { band: "3k_10k" }, deciding: "no" } }],
  ["brand-product-priority", { ...base, path: "brand", qualified: true, answers: { role: "brand", asset: "product_launch", platforms: ["instagram_reels", "x", "tiktok"], goal: "sales", timing: "two_weeks", budget: { band: "10k_50k" }, deciding: "yes" } }],
  ["creator-personal-soft", { ...base, bookingUrl: "", path: "creator", qualified: false, answers: { role: "creator", asset: "personal_brand", platforms: ["tiktok"], goal: "awareness", timing: "exploring", budget: { band: "under_3k" }, deciding: "no" } }],
  ["brand-podcast-qualified", { ...base, path: "brand", qualified: true, answers: { role: "brand", asset: "podcast_stream", platforms: ["youtube_shorts", "tiktok"], goal: "views", timing: "next_quarter", budget: { band: "50k_plus" }, deciding: "no" } }],
  ["clipper-music-new", { ...base, bookingUrl: "", path: "clipper", qualified: false, answers: { role: "clipper", asset: "music", platforms: ["tiktok", "youtube_shorts"], goal: "side_income", timing: "new" } }],
  ["clipper-sports-paid", { ...base, bookingUrl: "", path: "clipper", qualified: false, answers: { role: "clipper", asset: "sports", platforms: ["x", "instagram_reels"], goal: "full_time", timing: "paid" } }],
];

const figure = /(\$\d[\d.,]*\d[KMB]?\+?|\$\d[KMB]?\+?|\b\d[\d.]*[KMB]\+?(?=[\s<.,]|$))/g;
// Every figure that appears anywhere in an approved proof item is allowed.
const approved = new Set(
  (Object.values(proofJson.items) as { status: string }[])
    .filter((i) => i.status === "approved")
    .flatMap((i) => JSON.stringify(i).match(figure) ?? []),
);

async function main() {
let failed = false;
for (const [name, input] of cases) {
  const guide = assembleGuide(input);
  const html = renderGuideHtml(guide, { asset: String(input.answers.asset), date: new Date("2026-10-08") });
  const pdf = await htmlToPdf(html);
  fs.writeFileSync(path.join(out, `${name}.pdf`), pdf);
  const text = guide.title + guide.intro + guide.sections.map((s) => s.title + s.html + JSON.stringify(s.platforms ?? "") + JSON.stringify(s.proof ?? "")).join("");
  const pages = pdfPageCount(pdf);
  const dashes = text.includes(String.fromCharCode(0x2014)) || html.includes(String.fromCharCode(0x2014));
  const figs = [...new Set((text.replace(/<[^>]+>/g, " ").match(figure) ?? []))].filter((f) => !approved.has(f));
  // Blank pages (needs pdftotext from poppler; skipped when it is missing).
  let blank: number[] = [];
  try {
    const txt = execFileSync("pdftotext", [path.join(out, `${name}.pdf`), "-"], { encoding: "utf8" });
    blank = txt.split("\f").slice(0, pages).map((t, i) => (t.trim().length < 5 ? i + 1 : 0)).filter(Boolean);
  } catch {
    /* poppler not installed */
  }
  const ok = pages >= 4 && pages <= 6 && !dashes && figs.length === 0 && blank.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${pages} pages, sections: ${guide.sections.map((s) => s.key).join(", ")}${dashes ? ", EM DASH" : ""}${blank.length ? `, blank pages: ${blank.join(" ")}` : ""}${figs.length ? `, unapproved figures: ${figs.join(" ")}` : ""}`);
}
process.exit(failed ? 1 : 0);
}

void main();
