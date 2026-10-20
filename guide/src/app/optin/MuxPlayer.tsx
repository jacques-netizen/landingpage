"use client";
// Mux's own hosted player in a frame. Mux keeps it working on every browser
// and phone (it carries its own HLS engine), so the page needs no MP4
// rendition and no player code of its own. Streams are capped at 1080p.
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/client/api";

type Props = { id: string; portrait?: boolean; label: string; className?: string };

export function MuxPlayer({ id, portrait, label, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // The frame loads only once it is near the screen, so six FAQ players cost nothing up front.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const params = new URLSearchParams({ "max-resolution": "1080p", "accent-color": "#c9a85c", "primary-color": "#ffffff", "metadata-video-title": label });
  const src = `https://player.mux.com/${id}?${params.toString()}`;
  const poster = `https://image.mux.com/${id}/thumbnail.webp?width=${portrait ? 720 : 1280}&time=1`;

  return (
    <div ref={ref} className={`op-player${portrait ? " portrait" : ""} ${className}`} style={near ? undefined : { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      {near && (
        <iframe
          src={src}
          title={label}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          onLoad={() => track("video_play", { media: id, muted: false, src: "mux-player-ready" })}
        />
      )}
    </div>
  );
}
