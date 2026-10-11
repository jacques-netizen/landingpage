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
  v.style.objectFit = src.fit;
  if (src.kind === "hls" && !nativeHls()) {
    void import("hls.js").then(({ default: Hls }) => {
      if (current !== src.src) return;
      if (!Hls.isSupported()) {
        // No media source extensions: try the plain MP4, else the HLS URL as is.
        v.src = src.fallback ?? src.src;
        v.load();
        return;
      }
      const h = new Hls({ capLevelToPlayerSize: true, startLevel: -1, maxBufferLength: 20 });
      let mediaRecoveries = 0;
      h.on(Hls.Events.ERROR, (_e, data) => {
        v.dispatchEvent(new CustomEvent("hlserror", { detail: { type: data.type, details: data.details, fatal: data.fatal } }));
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          h.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries += 1;
          h.recoverMediaError();
          return;
        }
        // HLS is not going to work on this device: switch to the plain MP4 when there is one.
        const at = v.currentTime;
        h.destroy();
        hls = null;
        if (src.fallback) {
          v.src = src.fallback;
          v.load();
          v.currentTime = at;
          v.play().catch(() => {});
        } else v.dispatchEvent(new Event("error"));
      });
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
