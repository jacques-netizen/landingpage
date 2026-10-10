import "server-only";
// The guide as a standalone HTML document for the PDF: the same GuideDoc as
// the web page, in the same dark gold style, with the fonts embedded. Flowing
// text sits in a table whose empty header and footer rows repeat on every
// page, which gives each page its top and bottom space.
import fs from "node:fs";
import path from "node:path";
import outline from "../../../../content/guide/outline.json";
import type { GuideDoc, GuideSection } from "@/lib/guide/doc";
import { money, short, CPM } from "@/lib/guide/model";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fileData = (rel: string, mime: string) => {
  try {
    return `data:${mime};base64,${fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), rel)).toString("base64")}`;
  } catch {
    return "";
  }
};

let fontCss: string | null = null;
function fonts() {
  if (fontCss) return fontCss;
  const f = (file: string) => fileData(`assets/fonts/${file}`, "font/woff2");
  fontCss = `
@font-face{font-family:"EB Garamond";src:url(${f("EBGaramond.woff2")}) format("woff2");font-weight:400 800;font-style:normal}
@font-face{font-family:"EB Garamond";src:url(${f("EBGaramond-Italic.woff2")}) format("woff2");font-weight:400 800;font-style:italic}
@font-face{font-family:"Archivo";src:url(${f("Archivo.woff2")}) format("woff2");font-weight:100 900;font-style:normal}`;
  return fontCss;
}

const two = (n: number) => String(n).padStart(2, "0");
const labels = outline.labels as Record<string, string>;
const nl = outline.numbersLabels as Record<string, string>;

function numbersHtml(doc: GuideDoc): string {
  const n = doc.numbers;
  if (n.kind === "buyer") {
    const peak = n.months[2].total;
    return `<div class="model">
      <div class="ctrl"><span class="cl">${esc(nl.budgetSlider)}</span><span class="cv">${esc(money(n.monthlyBudget))}</span></div>
      <div class="out">
        <div class="o big"><div class="ov">${short(n.views.mid)}</div><div class="ol">${esc(nl.viewsMid)} $${CPM.mid.toFixed(2)}</div></div>
        <div class="o"><div class="ov">${short(n.views.low)}</div><div class="ol">${esc(nl.viewsLow)} $${CPM.low.toFixed(2)}</div></div>
        <div class="o"><div class="ov">${short(n.views.high)}</div><div class="ol">${esc(nl.viewsHigh)} $${CPM.high.toFixed(2)}</div></div>
      </div>
      <div class="out"><div class="o"><div class="ov">${n.perDay.mid.toLocaleString("en-US")}</div><div class="ol">${esc(nl.perDay)}</div></div>
        <div class="o"><div class="ov">${n.timesCurrentPost ? `${n.timesCurrentPost}x` : short(n.views.mid)}</div><div class="ol">${esc(n.timesCurrentPost ? nl.timesPost : nl.viewsMonth)}</div></div>
        <div class="o"><div class="ov">${short(peak)}</div><div class="ol">${esc(nl.monthThree)}</div></div></div>
      <div class="months">${n.months.map((m) => `<div class="month"><div class="mk">${esc(nl.month)} ${m.month}</div><div class="mv">${short(m.total)}</div><div class="mb"><span style="width:${Math.round((m.total / peak) * 100)}%"></span></div></div>`).join("")}</div>
      <p class="model-note">${esc(nl.buyerNote)}</p>
    </div>`;
  }
  return `<div class="model">
    <div class="ctrl"><span class="cl">${esc(nl.clipsSlider)}</span><span class="cv">${n.clipsPerWeek}</span></div>
    <div class="out">${n.perClip.map((c) => `<div class="o"><div class="ov">${esc(money(c.pay))}</div><div class="ol">${esc(nl.perClip)} ${short(c.views)} ${esc(nl.views)}</div></div>`).join("")}</div>
    <div class="out">${n.monthly.map((m) => `<div class="o"><div class="ov">${esc(money(m.pay))}</div><div class="ol">${esc(nl.monthIf)} ${short(m.avgViews)} ${esc(nl.views)}</div></div>`).join("")}</div>
    <p class="model-note">${esc(nl.clipperNote)}</p>
  </div>`;
}

function proofHtml(doc: GuideDoc): string {
  const band = doc.proof.find((p) => p.headline && !p.figures);
  const clients = doc.proof.find((p) => p.logos);
  const cases = doc.proof.filter((p) => p.figures || p.url);
  const bandHtml = band
    ? `<div class="proof-grid"><div class="pf big"><div class="pv">${esc(band.headline!)}</div><div class="pl">${esc(band.text)}</div></div><div class="pf"><div class="pv">4</div><div class="pl">${esc(labels.fourSteps)}</div></div></div>`
    : "";
  const casesHtml = cases.length
    ? `<div class="cases">${cases
        .map((p) => {
          const dl = p.objective
            ? `<dl><dt>${esc(labels.objectiveLabel)}</dt><dd>${esc(p.objective)}</dd>${p.strategy ? `<dt>${esc(labels.strategy)}</dt><dd>${esc(p.strategy)}</dd>` : ""}</dl>`
            : `<dd>${esc(p.text)}</dd>`;
          const kpis = p.figures ? `<div class="kpis">${p.figures.map((f) => `<div class="kpi"><div class="kv">${esc(f.value)}</div><div class="kl">${esc(f.label)}</div></div>`).join("")}</div>` : "";
          const url = p.url ? `<p class="src">${esc(p.url)}</p>` : "";
          return `<div class="case">${p.title ? `<div class="ct">${esc(p.title)}</div>` : ""}${dl}${kpis}${url}</div>`;
        })
        .join("")}</div>`
    : "";
  const logos = clients?.logos
    ? `<div class="clients">${clients.logos.map((l) => `<img src="${fileData(`public${l.src}`, l.src.endsWith(".svg") ? "image/svg+xml" : "image/png")}" alt="${esc(l.name)}">`).join("")}</div>`
    : "";
  return `${doc.proofIntro ? `<p class="body-lg">${esc(doc.proofIntro)}</p>` : ""}${bandHtml}${casesHtml}${logos}`;
}

function sectionHtml(s: GuideSection, i: number, doc: GuideDoc): string {
  const prose = s.html ? `<div class="prose">${s.html}</div>` : `<div class="prose">${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`;
  const bullets = s.bullets?.length ? `<ul class="bullets">${s.bullets.map((b, n) => `<li><span class="m">${two(n + 1)}</span><span>${esc(b)}</span></li>`).join("")}</ul>` : "";
  const steps = s.steps?.length ? `<div class="engine">${s.steps.map((st, n) => `<div class="eng"><div class="en">${two(n + 1)}</div><h4>${esc(st.title)}</h4><p>${esc(st.body)}</p></div>`).join("")}</div>` : "";
  const platforms = s.platforms
    ? `<p class="lead small">${esc(s.platforms.lead)}</p><div class="bars">${s.platforms.items
        .map((p, n) => `<div class="bar-row"><div class="bn"><small>${two(n + 1)}</small>${esc(p.name)}</div><div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(((s.platforms!.items.length - n) / s.platforms!.items.length) * 100)}%"></div></div><p>${esc(p.text)}</p></div></div>`)
        .join("")}</div>`
    : "";
  const numbers = s.numbers ? numbersHtml(doc) : "";
  const proof = s.proof ? proofHtml(doc) : "";
  const callout = s.callout ? `<div class="callout">${s.callout.label ? `<span class="label">${esc(s.callout.label)}</span>` : ""}<p>${esc(s.callout.text)}</p></div>` : "";
  return `<section class="sec">
    <p class="snum">${two(i)} ${esc(s.title)}</p>
    ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}
    ${prose}${bullets}${steps}${platforms}${numbers}${proof}${callout}
  </section>`;
}

export function renderGuideHtml(doc: GuideDoc, opts: { asset?: string; date: Date }): string {
  const coverFile = (outline.coverImages as Record<string, string>)[opts.asset ?? ""] ?? "bh-3.webp";
  const cover = fileData(`public/brand/${coverFile}`, "image/webp");
  const logo = fileData("public/brand/logo-nav-clear.png", "image/png");
  const date = new Date(doc.generatedAt || opts.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const flow = (parts: string[]) =>
    `<table class="flow"><thead><tr><td class="sp-top"></td></tr></thead><tfoot><tr><td class="sp-bottom"></td></tr></tfoot><tbody><tr><td>${parts.join("\n")}</td></tr></tbody></table>`;

  const summary = `<section class="sec">
    <p class="snum">00 ${esc(labels.summary)}</p>
    ${doc.summary.map((p) => `<p class="body-lg">${esc(p)}</p>`).join("")}
    <div class="facts"><div class="ck">${esc(labels.facts)}</div><ul>${doc.facts.map((f) => `<li><b>${esc(f.answer)}</b>${esc(f.question)}</li>`).join("")}</ul></div>
  </section>`;
  const sections = doc.sections.map((s, i) => sectionHtml(s, i + 1, doc));
  const close = `<section class="sec close">
    <p class="snum">${esc(labels.openGuide)}</p>
    <h2>${esc(doc.next.text)}</h2>
    ${doc.next.url ? `<p><a class="btn" href="${esc(doc.next.url)}">${esc(doc.next.label)}</a><br><span class="src">${esc(doc.next.url)}</span></p>` : ""}
    <p class="end">${esc(doc.footer)}</p>
  </section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(doc.hero.headline)}</title>
<style>${fonts()}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"EB Garamond",Georgia,serif;color:#efe7d5;background:#15120d;font-size:11.5pt;line-height:1.6}
.cover{height:297mm;position:relative;background:#15120d;page-break-after:always;overflow:hidden}
.cover .img{position:absolute;inset:0;background:url(${cover}) center 62%/cover no-repeat}
.cover .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(21,18,13,.55) 0%,rgba(21,18,13,.35) 30%,rgba(21,18,13,.9) 65%,#15120d 100%)}
.cover .logo{position:absolute;top:16mm;left:18mm;height:6mm;filter:brightness(0) invert(1)}
.cover .text{position:absolute;left:18mm;right:18mm;bottom:40mm}
.cover .kicker{font-family:"Archivo",Arial,sans-serif;font-weight:600;font-size:8pt;letter-spacing:.3em;text-transform:uppercase;color:#d4b26a;margin-bottom:8mm}
.cover h1{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:44pt;line-height:.94;letter-spacing:-.035em;text-transform:uppercase;max-width:160mm}
.cover h1 span{display:block;color:#ebd69e}
.cover .sub{margin-top:7mm;font-size:13pt;line-height:1.5;color:rgba(239,231,213,.85);max-width:110mm}
.cover .tiles{display:flex;gap:.3mm;margin-top:10mm;border:.3mm solid rgba(212,178,106,.11);background:rgba(212,178,106,.11)}
.cover .tile{flex:1;background:#1f1911;padding:6mm 5mm}
.cover .tv{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:22pt;color:#ebd69e;line-height:1;letter-spacing:-.02em}
.cover .tl{font-family:"Archivo",Arial,sans-serif;font-size:7.5pt;letter-spacing:.06em;color:#a09379;margin-top:2.5mm;line-height:1.45}
.cover .meta{position:absolute;left:18mm;right:18mm;bottom:16mm;display:flex;justify-content:space-between;border-top:.3mm solid rgba(212,178,106,.22);padding-top:4mm;font-family:"Archivo",Arial,sans-serif;font-size:7.5pt;letter-spacing:.2em;text-transform:uppercase;color:#a09379}
.cover .meta b{color:#ebd69e;font-weight:700}
.flow{width:100%;border-collapse:collapse}
.flow td{padding:0;vertical-align:top}
.sp-top{height:20mm}
.sp-bottom{height:18mm}
.sec{padding:0 18mm;margin-bottom:16mm;break-inside:auto}
.sec.close{margin-bottom:0;break-inside:avoid}
.snum{font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:8pt;letter-spacing:.3em;text-transform:uppercase;color:#d4b26a;margin-bottom:5mm;break-after:avoid}
.snum:before{content:"";display:inline-block;width:7mm;height:.3mm;background:#b8944f;vertical-align:middle;margin-right:3mm}
.lead{font-size:17pt;line-height:1.3;color:#efe7d5;max-width:130mm;margin-bottom:5mm;break-after:avoid}
.lead.small{font-size:13pt;margin-top:4mm}
.body-lg,.prose p{font-size:11.5pt;line-height:1.7;color:#a09379;max-width:140mm;margin-bottom:3.5mm;orphans:3;widows:3}
.prose p:last-child{margin-bottom:0}
.prose strong,.prose b,.body-lg b{color:#efe7d5;font-weight:500}
.prose h3{font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:8pt;letter-spacing:.2em;text-transform:uppercase;color:#a09379;margin:6mm 0 2.5mm;break-after:avoid}
.prose ul,.prose ol{list-style:none;margin:0 0 3.5mm;max-width:140mm}
.prose li{position:relative;padding:2.4mm 0 2.4mm 6mm;border-bottom:.3mm solid rgba(212,178,106,.11);color:#a09379;font-size:11pt;line-height:1.55;break-inside:avoid}
.prose li:before{content:"";position:absolute;left:0;top:4.6mm;width:3mm;height:.3mm;background:#b8944f}
.prose a{display:inline-block;margin-top:2mm;font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;padding:3.5mm 6mm;background:#b8944f;color:#15120d;text-decoration:none}
.bullets{list-style:none;margin-top:4mm;max-width:140mm;border-top:.3mm solid rgba(212,178,106,.11)}
.bullets li{display:flex;gap:4mm;align-items:baseline;padding:2.6mm 0;border-bottom:.3mm solid rgba(212,178,106,.11);font-size:11pt;color:#a09379;line-height:1.55;break-inside:avoid}
.bullets .m{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:8pt;color:#d4b26a;flex:none}
.callout{margin-top:6mm;background:#261f15;border-left:1mm solid #b8944f;padding:5mm 6mm;max-width:150mm;break-inside:avoid}
.callout .label{display:block;font-family:"Archivo",Arial,sans-serif;font-weight:600;font-size:7.5pt;letter-spacing:.3em;text-transform:uppercase;color:#d4b26a;margin-bottom:2mm}
.callout p{font-size:11pt;color:#efe7d5;line-height:1.6}
.engine{display:flex;flex-wrap:wrap;gap:3mm;margin-top:5mm}
.eng{flex:1 1 44%;background:#261f15;border:.3mm solid rgba(212,178,106,.11);padding:5mm;break-inside:avoid}
.eng .en{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:15pt;color:#b8944f;line-height:1;margin-bottom:3mm}
.eng h4{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:10.5pt;line-height:1.2;margin-bottom:2mm;color:#efe7d5}
.eng p{font-size:10pt;color:#a09379;line-height:1.5}
.bars{margin-top:3mm;max-width:150mm}
.bar-row{display:flex;gap:5mm;padding:3.5mm 0;border-bottom:.3mm solid rgba(212,178,106,.11);break-inside:avoid}
.bar-row .bn{width:34mm;flex:none;font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:10.5pt}
.bar-row .bn small{display:block;font-weight:600;font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:#d4b26a;margin-bottom:1mm}
.bar-row > div:last-child{flex:1}
.bar-track{height:2.5mm;background:#261f15;margin-bottom:2.5mm}
.bar-fill{height:100%;background:linear-gradient(90deg,#b8944f,#ebd69e)}
.bar-row p{font-size:10.5pt;color:#a09379;line-height:1.5}
.model{background:linear-gradient(160deg,#2e2519 0%,#1f1911 55%);border:.3mm solid rgba(212,178,106,.22);padding:7mm;margin-top:6mm;break-inside:avoid}
.ctrl{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4mm}
.ctrl .cl{font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:7.5pt;letter-spacing:.18em;text-transform:uppercase;color:#a09379}
.ctrl .cv{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:18pt;color:#ebd69e}
.out{display:flex;gap:.3mm;background:rgba(212,178,106,.11);border:.3mm solid rgba(212,178,106,.11);margin-top:.3mm}
.o{flex:1;background:#15120d;padding:5mm 4mm}
.o.big{flex:1.6}
.o .ov{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:16pt;color:#ebd69e;line-height:1;letter-spacing:-.02em}
.o.big .ov{font-size:26pt}
.o .ol{font-family:"Archivo",Arial,sans-serif;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:#a09379;margin-top:2mm;line-height:1.4}
.months{display:flex;gap:2mm;margin-top:5mm}
.month{flex:1;background:#261f15;border:.3mm solid rgba(212,178,106,.11);padding:3.5mm}
.month .mk{font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:#d4b26a}
.month .mv{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:13pt;color:#efe7d5;margin-top:1.5mm}
.month .mb{height:2mm;background:#2e2519;margin-top:2.5mm}
.month .mb span{display:block;height:100%;background:linear-gradient(90deg,#b8944f,#ebd69e)}
.model-note{font-size:10pt;color:#a09379;margin-top:5mm;line-height:1.55;max-width:140mm}
.proof-grid{display:flex;gap:.3mm;background:rgba(212,178,106,.11);border:.3mm solid rgba(212,178,106,.11);margin-top:5mm;break-inside:avoid}
.pf{flex:1;background:#15120d;padding:7mm 6mm}
.pf.big{flex:1.4}
.pf .pv{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:30pt;line-height:.9;letter-spacing:-.04em;color:#ebd69e}
.pf.big .pv{font-size:44pt}
.pf .pl{font-family:"Archivo",Arial,sans-serif;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#a09379;margin-top:3mm;line-height:1.45}
.cases{display:flex;flex-wrap:wrap;gap:3mm;margin-top:3mm}
.case{flex:1 1 44%;background:#1f1911;border:.3mm solid rgba(212,178,106,.11);padding:5mm;break-inside:avoid}
.case .ct{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:12pt;line-height:1.15}
.case dt{font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:#d4b26a;margin-top:3.5mm}
.case dd{font-size:10.5pt;color:#a09379;line-height:1.55;margin-top:1mm}
.kpis{display:flex;gap:.3mm;background:rgba(212,178,106,.11);border:.3mm solid rgba(212,178,106,.11);margin-top:3.5mm}
.kpi{flex:1;background:#261f15;padding:3mm}
.kpi .kv{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:13pt;color:#ebd69e;line-height:1}
.kpi .kl{font-family:"Archivo",Arial,sans-serif;font-size:6.5pt;letter-spacing:.08em;text-transform:uppercase;color:#a09379;margin-top:1.5mm}
.src{font-family:"Archivo",Arial,sans-serif;font-size:8pt;color:#6e6452;margin-top:2mm;word-break:break-all}
.clients{display:flex;flex-wrap:wrap;gap:8mm;align-items:center;margin-top:6mm}
.clients img{height:6mm;filter:brightness(0) invert(.92);opacity:.85}
.facts{margin-top:6mm;background:#1f1911;border:.3mm solid rgba(212,178,106,.11);padding:5mm 6mm;max-width:150mm;break-inside:avoid}
.facts .ck{font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:7.5pt;letter-spacing:.18em;text-transform:uppercase;color:#d4b26a;margin-bottom:2mm}
.facts ul{list-style:none;columns:2;column-gap:8mm}
.facts li{padding:2mm 0;border-bottom:.3mm solid rgba(212,178,106,.11);font-size:9.5pt;color:#a09379;line-height:1.45;break-inside:avoid}
.facts li b{display:block;color:#efe7d5;font-weight:500;font-size:10.5pt}
.close h2{font-family:"Archivo",Arial,sans-serif;font-weight:800;font-size:22pt;line-height:1.05;letter-spacing:-.025em;max-width:140mm;margin-bottom:6mm}
.btn{display:inline-block;font-family:"Archivo",Arial,sans-serif;font-weight:700;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;padding:4mm 7mm;background:#b8944f;color:#15120d;text-decoration:none;margin-bottom:2mm}
.end{margin-top:8mm;padding-top:5mm;border-top:.3mm solid rgba(212,178,106,.22);font-size:12pt;color:#a09379}
</style></head><body>
<div class="cover">
  <div class="img"></div><div class="shade"></div>
  ${logo ? `<img class="logo" src="${logo}" alt="Maison d’Élites">` : ""}
  <div class="text">
    <p class="kicker">${esc(doc.hero.kicker)}</p>
    <h1>${esc(doc.hero.headline)}</h1>
    <p class="sub">${esc(doc.hero.sub)}</p>
    <div class="tiles">${doc.hero.tiles.map((t) => `<div class="tile"><div class="tv">${esc(t.value)}</div><div class="tl">${esc(t.label)}</div></div>`).join("")}</div>
  </div>
  <div class="meta"><b>${esc(doc.preparedFor)}</b><span>${esc(date)}</span></div>
</div>
${flow([summary, ...sections, close])}
</body></html>`;
}
