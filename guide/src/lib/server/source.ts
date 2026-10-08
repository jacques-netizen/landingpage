import "server-only";

/** Keeps short, plain values only. Used for every query param we store. */
export function cleanParam(v: unknown, max = 64): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.normalize("NFKC").replace(/[^\p{L}\p{N}_.\-@ ]/gu, "").trim().slice(0, max);
  return s || undefined;
}

const KEYS = ["src", "mc", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

/** Source params stored on the session. The first name (fn) is never stored. */
export function cleanSource(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const k of KEYS) {
    const v = cleanParam((input as Record<string, unknown>)[k], k === "fbclid" ? 255 : 64);
    if (v) out[k] = v;
  }
  return out;
}

export function deviceClass(ua: string | null): string {
  const u = ua || "";
  if (/Instagram/i.test(u)) return "ig_inapp";
  if (/FBAN|FBAV|FB_IAB/i.test(u)) return "fb_inapp";
  if (/iPhone|iPad|iPod/i.test(u)) return "ios";
  if (/Android/i.test(u)) return "android";
  if (/bot|crawl|spider|headless/i.test(u)) return "bot";
  return "desktop";
}
