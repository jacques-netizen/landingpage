"use client";
// A founder or proof film. Plays in the shared film element with sound when
// the Start tap allowed it, otherwise muted with a tap for sound. No skip; the
// way on unlocks at the step's unlockAt share (85%) or at the end.
import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { copy, proof, type Step } from "@/lib/content";
import { track } from "@/lib/client/api";
import { film, load } from "@/lib/video/player";
import { videoSource } from "@/lib/video/source";
import { Captions } from "../Captions";
import { useFunnel } from "../context";
import { Pill, PlaceholderBadge } from "../ui";

type Phase = "starting" | "playing" | "paused" | "blocked" | "ended" | "failed";

export function FilmScene({ step }: { step: Step }) {
  const f = useFunnel();
  const src = step.media ? videoSource(step.media) : null;
  const holder = useRef<HTMLDivElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [muted, setMuted] = useState(false);
  const [unlockedNext, setUnlockedNext] = useState(false);
  const [share, setShare] = useState(0);
  const chapter = step.chapter ? (copy.chapters as unknown as Record<string, { title?: string } | undefined>)[step.chapter] : undefined;
  const unlockAt = step.unlockAt ?? 0.85;
  const isProof = step.chapter === "chapter2";

  useEffect(() => {
    const box = holder.current;
    if (!src || !box) return;
    const v = film();
    load(src);
    v.loop = false;
    box.appendChild(v);
    setVideo(v);
    v.currentTime = 0;
    const quartiles = new Set<number>();
    const onTime = () => {
      if (!v.duration) return;
      const s = v.currentTime / v.duration;
      setShare(s);
      if (s >= unlockAt) setUnlockedNext(true);
      for (const q of [25, 50, 75]) {
        if (s * 100 >= q && !quartiles.has(q)) {
          quartiles.add(q);
          track("video_progress", { media: src.id, pct: q });
        }
      }
    };
    const onEnded = () => {
      setPhase("ended");
      setUnlockedNext(true);
      if (!quartiles.has(100)) {
        quartiles.add(100);
        track("video_progress", { media: src.id, pct: 100 });
      }
    };
    const onPlay = () => {
      setPhase("playing");
      track("video_play", { media: src.id, muted: v.muted });
    };
    const onPause = () => {
      if (!v.ended && !v.error) {
        setPhase("paused");
        track("video_pause", { media: src.id, at: Math.round(v.currentTime) });
      }
    };
    // A film that cannot play must never trap anyone: show the poster, open the way on.
    const onError = () => {
      setPhase("failed");
      setUnlockedNext(true);
    };
    v.addEventListener("error", onError);
    if (v.error) onError();
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);

    // Try with sound first, then muted, then wait for a tap.
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setPhase((p) => (p === "failed" ? p : "blocked")));
    });

    return () => {
      v.removeEventListener("error", onError);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.pause();
      if (v.parentNode === box) box.removeChild(v);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src?.src]);

  const togglePlay = () => {
    const v = film();
    if (phase === "blocked" || v.paused) {
      v.muted = false;
      setMuted(false);
      v.play().catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      });
    } else v.pause();
  };

  const unmute = () => {
    const v = film();
    v.muted = false;
    setMuted(false);
    if (v.paused) v.play().catch(() => {});
  };

  const replay = () => {
    const v = film();
    v.currentTime = 0;
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {});
  };

  const views = proof("views_delivered");
  const clients = proof("clients");

  return (
    <section className="relative h-full w-full bg-ink-black text-cream" aria-label={chapter?.title}>
      <div ref={holder} className="absolute inset-0 md:mx-auto md:max-w-[min(100%,calc(100dvh*9/16))]" onClick={togglePlay} />
      {src?.poster && (phase === "starting" || phase === "failed") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src.poster} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover md:mx-auto md:max-w-[min(100%,calc(100dvh*9/16))]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/80" aria-hidden="true" />
      <Captions src={src?.captions ?? null} video={video} />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-5 pt-[max(22px,env(safe-area-inset-top))] md:px-12">
        {chapter?.title && (
          <m.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: share > 0.12 && phase !== "ended" ? 0 : 1, transition: { duration: 0.6 } }}
            className="max-w-[16ch] font-serif text-subtitle"
          >
            {chapter.title}
          </m.h2>
        )}
        {src?.placeholder && <PlaceholderBadge />}
      </header>

      {(phase === "blocked" || phase === "paused") && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cream/90 text-ink"
          aria-label={phase === "blocked" ? copy.common.tapToPlay : copy.common.play}
        >
          <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M0 0l22 13L0 26z" fill="currentColor" /></svg>
        </button>
      )}
      {muted && phase === "playing" && (
        <button type="button" onClick={unmute} className="absolute right-5 top-[max(64px,calc(env(safe-area-inset-top)+52px))] z-20 rounded-pill bg-cream px-4 py-2 text-[14px] font-medium text-ink">
          {copy.common.unmute}
        </button>
      )}

      {isProof && (phase === "ended" || phase === "failed") && (views || clients) && (
        <m.div
          initial={{ opacity: 0, y: f.reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
          className="absolute inset-x-0 top-[18%] z-20 px-5 md:px-12"
        >
          {views && <p className="font-serif text-hero">{views.headline}</p>}
          {views && <p className="mt-2 max-w-[30ch] text-lead text-cream/85">{views.text}</p>}
          {clients?.logos && (
            <div className="mt-8">
              <p className="sr-only">{copy.chapters.proofAfter.logosLabel}</p>
              <ul className="flex flex-wrap items-center gap-x-7 gap-y-4">
                {clients.logos.map((l) => (
                  <li key={l.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.src} alt={l.name} className="h-7 w-auto opacity-90 brightness-0 invert" loading="lazy" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </m.div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-[max(24px,env(safe-area-inset-bottom))] md:px-12">
        <div className="mb-5 h-[2px] w-full bg-white/15" aria-hidden="true">
          <div className="h-full bg-cream/80" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
        <div className="flex min-h-[52px] items-center justify-between gap-4">
          {phase === "ended" ? (
            <button type="button" onClick={replay} className="h-11 text-[15px] font-medium text-cream/80 hover:text-cream">
              {copy.common.replay}
            </button>
          ) : (
            <span />
          )}
          {unlockedNext && (
            <m.div initial={{ opacity: 0, y: f.reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}>
              <Pill tone="light" onClick={f.next}>
                {copy.common.continue} <span aria-hidden="true">&rarr;</span>
              </Pill>
            </m.div>
          )}
        </div>
      </div>
    </section>
  );
}
