// Meta Pixel. Loaded only after the gate consent is given; nothing loads
// before that. Events carry the same event ids as the server side CAPI
// events, so Meta counts each once.
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let started = false;

export function loadPixel(pixelId: string) {
  if (started || !pixelId || typeof window === "undefined") return;
  started = true;
  const q: unknown[] = [];
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else q.push(args);
  } as Fbq;
  fbq.queue = q;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  fbq("init", pixelId);
  fbq("track", "PageView");
}

export function pixelEvent(name: "Lead" | "Schedule", eventId: string, data: Record<string, unknown> = {}) {
  window.fbq?.("track", name, data, { eventID: eventId });
}
