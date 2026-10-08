// One shared <video> element for every film with sound. iOS only lets an
// element play with sound after a tap on that element's play(), so the Start
// tap calls unlock() and every later film reuses the same element, moved into
// whichever scene is on screen.
import type { VideoSource } from "./source";

let el: HTMLVideoElement | null = null;
let current: string | null = null;
let hls: { destroy(): void } | null = null;
let unlocked = false;

export function film(): HTMLVideoElement {
  if (!el) {
    el = document.createElement("video");
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.preload = "auto";
    el.className = "absolute inset-0 h-full w-full object-cover";
    el.setAttribute("aria-hidden", "true");
  }
  return el;
}

export const soundUnlocked = () => unlocked;

/** Call inside a tap handler, synchronously. Loads the first film too. */
export function unlock(first?: VideoSource | null) {
  const v = film();
  if (first) load(first);
  v.muted = false;
  try {
    const p = v.play();
    unlocked = true;
    p?.then(() => v.pause()).catch(() => {});
  } catch {
    /* play() can throw synchronously on old WebKit */
  }
}

const nativeHls = () => film().canPlayType("application/vnd.apple.mpegurl") !== "";

export function load(src: VideoSource) {
  const v = film();
  if (current === src.src && !v.error) return;
  current = src.src;
  hls?.destroy();
  hls = null;
  v.poster = src.poster ?? "";
  v.loop = src.loop;
  if (src.kind === "hls" && !nativeHls()) {
    void import("hls.js").then(({ default: Hls }) => {
      if (current !== src.src) return;
      if (!Hls.isSupported()) {
        v.src = src.src;
        return;
      }
      const h = new Hls({ capLevelToPlayerSize: true, startLevel: -1 });
      h.loadSource(src.src);
      h.attachMedia(v);
      hls = h;
    });
  } else {
    v.src = src.src;
    v.load();
  }
}

/** Warm the network for a film that is coming up next. */
export function preload(src: VideoSource | null) {
  if (!src || typeof document === "undefined") return;
  if (src.poster) {
    const img = new Image();
    img.src = src.poster;
  }
  if (src.kind === "mp4" && !document.querySelector(`link[data-preload="${src.id}"]`)) {
    // Browsers do not support preload as=video; prefetch warms the HTTP cache.
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = src.src;
    link.dataset.preload = src.id;
    document.head.appendChild(link);
  }
}
