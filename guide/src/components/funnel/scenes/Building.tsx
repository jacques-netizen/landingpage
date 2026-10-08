"use client";
// S8: a short build sequence while the server stores the lead and starts the
// guide. At least 3 seconds, about 5 when the server is quick, and it moves on
// regardless after 8 seconds (the email follows on its own).
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { copy } from "@/lib/content";
import { useFunnel } from "../context";
import { Logo } from "../ui";

const MIN_MS = 3000;
const TARGET_MS = 4800;
const MAX_MS = 8000;

export function BuildingScene() {
  const f = useFunnel();
  const lines = copy.building.lines;
  const [elapsed, setElapsed] = useState(0);
  const moved = useRef(false);

  useEffect(() => {
    const started = Date.now();
    const t = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const ready = f.leadSettled && f.lead;
    // MIN_MS is the floor even if TARGET_MS is ever tuned below it.
    if (!moved.current && ((ready && elapsed >= Math.max(MIN_MS, TARGET_MS)) || elapsed >= MAX_MS)) {
      moved.current = true;
      f.next();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const i = Math.min(lines.length - 1, Math.floor((elapsed / TARGET_MS) * lines.length));

  return (
    <section className="flex h-full flex-col bg-ink text-cream" role="status" aria-live="polite">
      <div className="px-5 pt-[max(22px,env(safe-area-inset-top))] md:px-12">
        <Logo light />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 md:px-12">
        <span className="sr-only">{copy.building.srStatus}</span>
        <AnimatePresence mode="wait">
          <m.p
            key={i}
            initial={{ opacity: 0, y: f.reduced ? 0 : 20, filter: f.reduced ? "none" : "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: f.reduced ? 0 : -14, transition: { duration: 0.3 } }}
            className="font-serif text-display"
          >
            {lines[i]}
            <span className="text-gold-light">.</span>
          </m.p>
        </AnimatePresence>
        <div className="mt-10 h-[2px] w-full bg-white/15" aria-hidden="true">
          <div className="h-full bg-gold-light transition-[width] duration-200 ease-linear" style={{ width: `${Math.min(100, (elapsed / TARGET_MS) * 100)}%` }} />
        </div>
      </div>
    </section>
  );
}
