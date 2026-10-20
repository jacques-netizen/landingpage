"use client";
// A plain Mux player with the browser's own controls. Safari plays the HLS
// stream natively; everything else goes through hls.js; when that fails, or
// a frame never shows, the MP4 rendition takes over. One element per video,
// nothing shared, so it works on any page.
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/client/api";

type Props = { id: string; portrait?: boolean; label: string; className?: string };

export function MuxPlayer({ id, portrait, label, className = "" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const hlsUrl = `https://stream.mux.com/${id}.m3u8`;
  const mp4Url = `https://stream.mux.com/${id}/highest.mp4`;
  const poster = `https://image.mux.com/${id}/thumbnail.webp?width=${portrait ? 720 : 1280}&time=1`;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let hls: { destroy(): void } | null = null;
    let onMp4 = false;
    let alive = true;
    const toMp4 = (why: string) => {
      if (onMp4 || !alive) return;
      onMp4 = true;
      hls?.destroy();
      hls = null;
      track("video_error", { media: id, code: 0, src: why, ua: navigator.userAgent.slice(0, 80) });
      v.src = mp4Url;
      v.load();
    };
    const onPlay = () => track("video_play", { media: id, muted: v.muted });
    const onError = () => {
      if (!onMp4) toMp4("element error");
      else setFailed(true);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("error", onError);

    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = hlsUrl;
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (!alive) return;
        if (!Hls.isSupported()) return toMp4("no mse");
        const h = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 20 });
        hls = h;
        h.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
          else toMp4(`hls ${data.details}`);
        });
        h.loadSource(hlsUrl);
        h.attachMedia(v);
        // A stream that shows nothing after the viewer pressed play is not going to.
        const watch = () => {
          window.setTimeout(() => {
            if (alive && !v.paused && v.readyState < 2 && navigator.onLine) toMp4("no frame");
          }, 8000);
        };
        v.addEventListener("play", watch, { once: true });
      });
    }
    return () => {
      alive = false;
      v.removeEventListener("play", onPlay);
      v.removeEventListener("error", onError);
      hls?.destroy();
    };
  }, [id, hlsUrl, mp4Url]);

  return (
    <div className={`op-player${portrait ? " portrait" : ""} ${className}`}>
      <video ref={ref} controls playsInline preload="metadata" poster={poster} aria-label={label} />
      {failed && <a className="op-player-fallback" href={mp4Url} target="_blank" rel="noopener noreferrer">Open the video</a>}
    </div>
  );
}
