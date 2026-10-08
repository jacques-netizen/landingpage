"use client";
// Chapter 3, built in code: the four steps from the live site's "How it
// works", told from the buyer side or the clipper side. Each step holds for a
// few seconds (about 32 seconds in all); a tap moves on sooner.
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { copy, fill, type Step } from "@/lib/content";
import { useFunnel } from "../context";
import { BackButton, Pill } from "../ui";

export function StepsScene({ step }: { step: Step }) {
  const f = useFunnel();
  const c = copy.chapters.chapter3;
  const side = f.path === "clipper" ? "clipper" : "buyer";
  const items = c.steps[side];
  const [i, setI] = useState(-1); // -1 is the title card
  const hold = (c.stepSeconds || 8) * 1000;
  const done = i >= items.length - 1;

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setI((x) => x + 1), i < 0 ? 2600 : hold);
    return () => window.clearTimeout(t);
  }, [i, done, hold]);

  const item = i >= 0 ? items[i] : null;
  const move = f.reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : undefined;

  return (
    <section data-step={step.id} className="relative h-full w-full overflow-hidden bg-ink-black text-cream" aria-roledescription="slides" aria-label={c.title}>
      <AnimatePresence mode="sync" initial={false}>
        {item && (
          <m.div
            key={item.image}
            className="absolute inset-0"
            {...(move ?? {
              initial: { opacity: 0, scale: 1.06 },
              animate: { opacity: 1, scale: 1, transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } },
              exit: { opacity: 0, transition: { duration: 0.6 } },
            })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-60" />
          </m.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-ink-black/80 via-ink-black/30 to-ink-black" aria-hidden="true" />

      <div className="absolute inset-x-0 top-0 z-20 px-5 pt-[max(14px,env(safe-area-inset-top))] md:px-12">
        <div className="flex gap-1.5 pt-2" aria-hidden="true">
          {items.map((_, n) => (
            <span key={n} className="h-[2px] flex-1 overflow-hidden bg-white/20">
              <span
                className="block h-full origin-left bg-cream"
                style={{
                  transform: `scaleX(${n < i ? 1 : n === i ? 1 : 0})`,
                  transition: n === i && !f.reduced ? `transform ${hold}ms linear` : "none",
                }}
              />
            </span>
          ))}
        </div>
        <div className="mt-2">
          <BackButton onClick={f.back} dark />
        </div>
      </div>

      <button
        type="button"
        className="absolute inset-0 z-10 cursor-default"
        aria-label={c.next}
        onClick={() => !done && setI((x) => x + 1)}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-[max(28px,env(safe-area-inset-bottom))] md:mx-auto md:max-w-4xl md:px-12 md:pb-20">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={i}
            aria-live="polite"
            {...(move ?? {
              initial: { opacity: 0, y: 22 },
              animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
              exit: { opacity: 0, y: -10, transition: { duration: 0.3 } },
            })}
          >
            {item ? (
              <>
                <p className="sr-only">{fill(c.stepLabel, { n: String(i + 1), total: String(items.length) })}</p>
                <h2 className="font-serif text-display">{item.title}</h2>
                <p className="mt-4 max-w-[34ch] text-lead text-cream/85">{item.body}</p>
              </>
            ) : (
              <>
                <h2 className="font-serif text-hero">{c.title}</h2>
                <p className="mt-4 max-w-[30ch] font-serif text-subtitle italic text-gold-light">{c.lead[side]}</p>
              </>
            )}
          </m.div>
        </AnimatePresence>
        <div className="pointer-events-auto mt-8 flex min-h-[52px] items-center justify-end">
          {done ? (
            <Pill tone="light" onClick={f.next}>
              {c.done} <span aria-hidden="true">&rarr;</span>
            </Pill>
          ) : (
            <button type="button" onClick={() => setI((x) => x + 1)} className="h-11 px-2 text-[15px] font-medium text-cream/80 hover:text-cream">
              {c.next} <span aria-hidden="true">&rarr;</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
