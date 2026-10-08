"use client";
import { m } from "framer-motion";
import { copy, fill, type Step } from "@/lib/content";
import { stepsFor } from "@/lib/flow";
import { unlock } from "@/lib/video/player";
import { videoSource } from "@/lib/video/source";
import { useFunnel } from "../context";
import { Logo, Pill, PlaceholderBadge } from "../ui";

export function ColdOpen({ step }: { step: Step }) {
  const f = useFunnel();
  const bg = step.media ? videoSource(step.media) : null;
  const c = copy.coldOpen;

  const start = () => {
    // Inside the tap: bless the shared film element so the next film can play with sound.
    const firstFilm = stepsFor(f.variant, f.answers).find((s) => s.scene === "film" && s.media);
    unlock(firstFilm?.media ? videoSource(firstFilm.media) : null);
    f.next();
  };

  const rise = (i: number) =>
    f.reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.15 + i * 0.09, ease: [0.22, 1, 0.36, 1] as const } },
        };

  return (
    <section className="relative flex h-full flex-col bg-ink-black text-cream">
      {bg && (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          src={bg.src}
          poster={bg.poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-black/70 via-ink-black/25 to-ink-black/95" aria-hidden="true" />
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))] md:px-12">
        <Logo light />
        {bg?.placeholder && <PlaceholderBadge />}
      </header>
      <div className="relative z-10 mt-auto px-5 pb-[max(28px,env(safe-area-inset-bottom))] md:mx-auto md:w-full md:max-w-3xl md:pb-20">
        <m.p {...rise(0)} className="font-serif text-subtitle text-gold-light">
          {f.firstName ? fill(c.greetingNamed, { name: f.firstName }) : c.greeting}
        </m.p>
        <m.h1 {...rise(1)} className="mt-2 font-serif text-hero">
          {c.headline}
        </m.h1>
        <m.p {...rise(2)} className="mt-5 max-w-[34ch] text-lead text-cream/80">
          {c.body}
        </m.p>
        <m.div {...rise(3)} className="mt-8 flex items-center gap-5">
          <Pill tone="light" onClick={start} className="min-w-[160px]">
            {c.start} <span aria-hidden="true">&rarr;</span>
          </Pill>
          <span className="text-[13px] text-cream/70">{c.soundNote}</span>
        </m.div>
      </div>
    </section>
  );
}
