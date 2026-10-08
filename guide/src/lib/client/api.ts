import type { EventName } from "@/lib/events";

let sessionToken: string | null = null;
// Events fired before the session exists (the cold open renders at once)
// wait here and go out as soon as the token arrives.
const early: [EventName, Record<string, unknown>][] = [];
export const setApiToken = (t: string | null) => {
  sessionToken = t;
  if (t) for (const [name, props] of early.splice(0)) track(name, props);
};

export async function postJson<T>(url: string, body: unknown, timeoutMs = 10_000): Promise<{ ok: boolean; status: number; data: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      keepalive: JSON.stringify(body).length < 60_000,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Fire and forget analytics. Never pass personal data in props. */
export function track(name: EventName, props: Record<string, unknown> = {}) {
  if (!sessionToken) {
    if (early.length < 50) early.push([name, props]);
    return;
  }
  const body = JSON.stringify({ token: sessionToken, name, props });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/event", new Blob([body], { type: "text/plain" }))) return;
  } catch {
    /* fall through to fetch */
  }
  fetch("/api/event", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
}
