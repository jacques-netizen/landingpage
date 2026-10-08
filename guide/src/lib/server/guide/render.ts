import "server-only";
// The guide as a standalone HTML document, rendered to PDF by Chromium.
// Editorial and type led (section 9.2): a cover, then each section as large
// serif headings over a narrow reading column. Fonts are embedded.
import fs from "node:fs";
import path from "node:path";
import outline from "../../../../content/guide/outline.json";
import type { Guide } from "./assemble";

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

export function renderGuideHtml(guide: Guide, opts: { asset?: string; date: Date }): string {
  const coverFile = (outline.coverImages as Record<string, string>)[opts.asset ?? ""] ?? "bh-3.webp";
  const cover = fileData(`public/brand/${coverFile}`, "image/webp");
  const logo = fileData("public/brand/logo-nav-clear.png", "image/png");
  const date = opts.date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const rendered = guide.sections
    .map((s, i) => {
      const dark = Boolean(s.proof);
      const platforms = s.platforms
        ? `<p class="lead-line">${esc(s.platforms.lead)}</p>
           <ol class="platforms">${s.platforms.items
             .map((p, n) => `<li><span class="pn">${two(n + 1)}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.text)}</p></div></li>`)
             .join("")}</ol>`
        : "";
      const proof = s.proof
        ? `<div class="proof">${s.proof
            .map((p) => {
              const figs = (p.figures ?? []).map((f) => `<p class="fig"><span class="figv">${esc(f.value)}</span> <span class="figl">${esc(f.label)}</span></p>`).join("");
              const head = p.headline ? `<p class="fig"><span class="figv">${esc(p.headline)}</span></p>` : "";
              const logos = (p.logos ?? []).map((l) => `<img src="${fileData(`public${l.src}`, l.src.endsWith(".svg") ? "image/svg+xml" : "image/png")}" alt="${esc(l.name)}">`).join("");
              return `<div class="proof-item">${p.title ? `<h3>${esc(p.title)}</h3>` : ""}${head}${figs}<p>${esc(p.text)}</p>${p.url ? `<p class="src">${esc(p.url)}</p>` : ""}${logos ? `<div class="logos">${logos}</div>` : ""}</div>`;
            })
            .join("")}</div>`
        : "";
      return {
        dark,
        html: `<section class="sec${dark ? " dark" : ""}">
        <p class="num">${two(i + 1)}</p>
        <h2>${esc(s.title)}</h2>
        <div class="body">${s.html}${platforms}${proof}</div>
      </section>`,
      };
    });

  // Pages have no margin so the paper color reaches every edge. Flowing text
  // sits in a table whose empty header and footer rows repeat on every page,
  // which gives each page its top and bottom space. Dark sections are full
  // pages of their own between those runs.
  const flow = (parts: string[]) =>
    `<table class="flow"><thead><tr><td class="sp-top"></td></tr></thead><tfoot><tr><td class="sp-bottom"></td></tr></tfoot><tbody><tr><td>${parts.join("\n")}</td></tr></tbody></table>`;
  const chunks: string[] = [];
  let run: string[] = [];
  for (const r of rendered) {
    if (r.dark) {
      if (run.length) chunks.push(flow(run));
      run = [];
      chunks.push(r.html);
    } else run.push(r.html);
  }
  run.push(`<p class="end">${esc(guide.footer)}</p>`);
  chunks.push(flow(run));
  const sections = chunks.join("\n");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(guide.title)}</title>
<style>${fonts()}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Archivo",Arial,sans-serif;color:#1a1510;background:#f2eee6;font-size:11pt;line-height:1.62;font-weight:400}
.cover{height:297mm;position:relative;background:#f2eee6;page-break-after:always;overflow:hidden}
.cover .img{height:150mm;background:url(${cover}) center/cover no-repeat}
.cover .logo{position:absolute;top:14mm;left:18mm;height:6mm;padding:2.2mm 4mm;background:rgba(242,238,230,.92);border-radius:999px;box-sizing:content-box}
.cover .text{padding:16mm 18mm 0}
.cover h1{font-family:"EB Garamond",Georgia,serif;font-weight:400;font-size:46pt;line-height:.98;letter-spacing:-.03em;max-width:150mm}
.cover .intro{margin-top:8mm;font-size:12pt;line-height:1.55;color:#4f493f;max-width:120mm}
.cover .meta{position:absolute;left:18mm;right:18mm;bottom:16mm;display:flex;justify-content:space-between;border-top:.3mm solid #d8cdb9;padding-top:4mm;font-size:9.5pt;color:#6e675c}
.cover .meta b{font-family:"EB Garamond",Georgia,serif;font-weight:400;font-style:italic;font-size:14pt;color:#8a6a22}
.sec{padding:0 22mm 0 52mm;position:relative;margin-bottom:16mm;break-inside:avoid}
.sec .num{position:absolute;left:18mm;top:1mm;font-family:"EB Garamond",Georgia,serif;font-size:22pt;color:#a8843a;line-height:1}
.sec h2{font-family:"EB Garamond",Georgia,serif;font-weight:400;font-size:28pt;line-height:1.02;letter-spacing:-.025em;margin-bottom:7mm;break-after:avoid}
.sec .body{max-width:118mm}
.sec .body p{margin-bottom:3.6mm;orphans:3;widows:3}
.sec .body strong{font-weight:600;color:#1a1510}
.sec .body p:first-child{font-family:"EB Garamond",Georgia,serif;font-size:15pt;line-height:1.38;color:#1a1510}
.sec .body a{display:inline-block;margin-top:3mm;background:#1a1510;color:#fff;text-decoration:none;padding:3.4mm 6mm;border-radius:999px;font-weight:500;font-size:10.5pt}
.sec .body p{color:#4f493f}
.lead-line{margin-top:2mm;font-family:"EB Garamond",Georgia,serif;font-style:italic;font-size:14pt!important;color:#8a6a22!important}
.platforms{list-style:none;margin-top:5mm;border-top:.3mm solid #d8cdb9}
.platforms li{display:flex;gap:6mm;padding:5mm 0;border-bottom:.3mm solid #d8cdb9;break-inside:avoid}
.platforms .pn{font-family:"EB Garamond",Georgia,serif;font-size:13pt;color:#a8843a;width:8mm;flex:none}
.platforms h3{font-family:"EB Garamond",Georgia,serif;font-weight:400;font-size:16pt;line-height:1.1;margin-bottom:1.5mm}
.platforms p{margin:0!important;font-family:"Archivo",Arial,sans-serif!important;font-size:10.5pt!important;line-height:1.55!important;color:#4f493f!important}
.flow{width:100%;border-collapse:collapse;break-before:page}
.flow td{padding:0;vertical-align:top}
.flow .sec:last-child{margin-bottom:0}
.sp-top{height:22mm}
.sp-bottom{height:18mm}
.sec.dark{break-before:page;break-after:page;background:#1a1510;color:#f4f1ea;height:296mm;overflow:hidden;padding-top:24mm;padding-bottom:20mm;margin-bottom:0}
.sec.dark .num{top:24mm;color:#d8c58f}
.sec.dark h2{color:#f4f1ea}
.sec.dark .body p,.sec.dark .body p:first-child{color:rgba(244,241,234,.8)}
.proof-item{margin-top:9mm;padding-top:6mm;border-top:.3mm solid rgba(244,241,234,.2);break-inside:avoid}
.proof-item h3{font-family:"EB Garamond",Georgia,serif;font-weight:400;font-style:italic;font-size:15pt;color:#d8c58f;margin-bottom:2mm}
.proof .fig{margin:0!important;line-height:1.05!important}
.proof .figv{font-family:"EB Garamond",Georgia,serif;font-size:40pt;color:#f4f1ea;letter-spacing:-.02em}
.proof .figl{font-size:11pt;color:rgba(244,241,234,.75)}
.proof .src{font-size:9pt!important;color:rgba(244,241,234,.55)!important}
.logos{display:flex;flex-wrap:wrap;gap:7mm;align-items:center;margin-top:4mm}
.logos img{height:7mm;filter:brightness(0) invert(1);opacity:.9}
.end{margin:6mm 22mm 0 52mm;padding-top:5mm;border-top:.3mm solid #d8cdb9;font-family:"EB Garamond",Georgia,serif;font-size:13pt;color:#6e675c}
</style></head><body>
<div class="cover">
  <div class="img"></div>
  ${logo ? `<img class="logo" src="${logo}" alt="Maison d’Élites">` : ""}
  <div class="text"><h1>${esc(guide.title)}</h1><p class="intro">${esc(guide.intro)}</p></div>
  <div class="meta"><b>${esc(guide.preparedFor)}</b><span>${esc(date)}</span></div>
</div>
${sections}
</body></html>`;
}
