"use client";
// Caption overlay read from the film's WebVTT file. Used on every film so
// captions show even where native text tracks do not render (in-app browsers).
import { useEffect, useState } from "react";
import { parseVtt, type Cue } from "@/lib/video/vtt";

export function Captions({ src, video }: { src: string | null; video: HTMLVideoElement | null }) {
  const [cues, setCues] = useState<Cue[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!src) return;
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => alive && setCues(parseVtt(t)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    if (!video || cues.length === 0) return;
    const onTime = () => {
      const t = video.currentTime;
      setText(cues.find((c) => t >= c.start && t < c.end)?.text ?? "");
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onTime);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeked", onTime);
    };
  }, [video, cues]);

  if (!src) return null;
  return (
    <div aria-live="off" className="pointer-events-none absolute inset-x-0 bottom-[28%] z-10 flex justify-center px-6">
      {text && (
        <p className="max-w-[30ch] rounded-md bg-black/60 px-3 py-1.5 text-center text-[17px] font-medium leading-snug text-white md:text-[20px]">
          {text}
        </p>
      )}
    </div>
  );
}
