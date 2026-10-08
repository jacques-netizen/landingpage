"use client";
import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/content";
import { track } from "@/lib/client/api";
import { film, load } from "@/lib/video/player";
import type { VideoSource } from "@/lib/video/source";
import { Captions } from "../Captions";
import { PlaceholderBadge } from "../ui";

/** The personal video at the top of the result page, in the shared film element. */
export function ResultFilm({ src }: { src: VideoSource }) {
  const holder = useRef<HTMLDivElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [state, setState] = useState<"playing" | "paused" | "muted" | "failed">("paused");

  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    const v = film();
    load(src);
    v.loop = false;
    box.appendChild(v);
    setVideo(v);
    const seen = new Set<number>();
    const onTime = () => {
      if (!v.duration) return;
      const pct = (v.currentTime / v.duration) * 100;
      for (const q of [25, 50, 75]) if (pct >= q && !seen.has(q)) { seen.add(q); track("video_progress", { media: src.id, pct: q }); }
    };
    const onEnd = () => { if (!seen.has(100)) { seen.add(100); track("video_progress", { media: src.id, pct: 100 }); } setState("paused"); };
    const onPlay = () => { setState(v.muted ? "muted" : "playing"); track("video_play", { media: src.id, muted: v.muted }); };
    const onPause = () => { if (!v.ended) { setState("paused"); track("video_pause", { media: src.id, at: Math.round(v.currentTime) }); } };
    const onError = () => setState("failed");
    v.addEventListener("error", onError);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.currentTime = 0;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => setState((s) => (s === "failed" ? s : "paused")));
    });
    return () => {
      v.removeEventListener("error", onError);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.pause();
      if (v.parentNode === box) box.removeChild(v);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src.src]);

  const toggle = () => {
    const v = film();
    if (v.muted) {
      v.muted = false;
      setState("playing");
      if (v.paused) void v.play().catch(() => {});
      return;
    }
    if (v.paused) {
      if (v.ended) v.currentTime = 0;
      void v.play().catch(() => {});
    } else v.pause();
  };

  return (
    <div className="relative mx-auto aspect-[9/16] max-h-[78dvh] w-full max-w-[min(100%,calc(78dvh*9/16))] overflow-hidden bg-ink-black md:rounded-[28px]">
      <div ref={holder} className="absolute inset-0" onClick={toggle} />
      {state === "failed" && src.poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src.poster} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {src.placeholder && <div className="absolute right-4 top-4 z-20"><PlaceholderBadge /></div>}
      <Captions src={src.captions} video={video} />
      {state !== "playing" && state !== "failed" && (
        <button type="button" onClick={toggle} className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-pill bg-cream px-5 py-2.5 text-[14px] font-medium text-ink">
          {state === "muted" ? copy.common.unmute : copy.common.play}
        </button>
      )}
    </div>
  );
}
