import "server-only";
// HTML to PDF with Playwright and Chromium. On Vercel the Chromium binary
// comes from @sparticuz/chromium; locally CHROMIUM_PATH or the Playwright
// install is used.
import fs from "node:fs";

async function executable(): Promise<{ path?: string; args: string[] }> {
  if (process.env.CHROMIUM_PATH) return { path: process.env.CHROMIUM_PATH, args: [] };
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return { path: await chromium.executablePath(), args: chromium.args };
  }
  const local = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  return { path: fs.existsSync(local) ? local : undefined, args: [] };
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const { chromium } = await import("playwright-core");
  const exe = await executable();
  const browser = await chromium.launch({ executablePath: exe.path, args: exe.args, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Counts pages in a PDF buffer (for tests and the acceptance check). */
export function pdfPageCount(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
