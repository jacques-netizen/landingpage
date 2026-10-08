"use client";
// Cloudflare Turnstile, loaded only on the gate and only when a site key is set.
import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loader: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loader = null;
        reject(new Error("turnstile failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

export function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (t: string | null) => void; resetKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !ref.current || !window.turnstile) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          theme: "light",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetKey]);

  return <div ref={ref} className="min-h-0" />;
}
