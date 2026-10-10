"use client";
// Scroll behaviour for the guide page: reveal on scroll, the thin progress
// line, and the platform bars filling when they come into view.
import { useEffect } from "react";

export function GuideClient() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".gd");
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rv = root.querySelectorAll<HTMLElement>(".rv");
    const bars = root.querySelectorAll<HTMLElement>(".bar-fill");
    if (reduce || !("IntersectionObserver" in window)) {
      rv.forEach((el) => el.classList.add("in"));
      bars.forEach((b) => (b.style.width = `${b.dataset.pct}%`));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          if (el.classList.contains("bar-fill")) el.style.width = `${el.dataset.pct}%`;
          else el.classList.add("in");
          io.unobserve(el);
        }
      },
      { threshold: 0.08 },
    );
    rv.forEach((el) => io.observe(el));
    bars.forEach((el) => io.observe(el));
    const prog = root.querySelector<HTMLElement>(".progress");
    const onScroll = () => {
      const h = document.documentElement;
      if (prog) prog.style.width = `${(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100}%`;
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}
