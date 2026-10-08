"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { copy } from "@/lib/content";
import { frontLoaded } from "@/lib/flow";

export function Pill({
  children,
  tone = "ink",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ink" | "light" | "ghost"; children: ReactNode }) {
  const tones = {
    ink: "bg-ink text-white hover:bg-ink-soft disabled:bg-ink/40",
    light: "bg-cream text-ink hover:bg-white disabled:opacity-50",
    ghost: "border border-line-strong bg-white/50 text-ink hover:bg-white",
  };
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex h-[52px] items-center justify-center gap-2 rounded-pill px-7 text-[15px] font-medium transition-colors duration-200 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function BackButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-ml-2 inline-flex h-11 items-center gap-2 px-2 text-[14px] font-medium ${dark ? "text-cream/80 hover:text-cream" : "text-muted hover:text-ink"}`}
    >
      <span aria-hidden="true" className="text-[18px] leading-none">&larr;</span>
      {copy.common.back}
    </button>
  );
}

export function ProgressLine({ share, mode, dark = false }: { share: number; mode: "front_loaded" | "none"; dark?: boolean }) {
  if (mode === "none") return null;
  const v = frontLoaded(share);
  return (
    <div
      role="progressbar"
      aria-label={copy.common.progressLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={`absolute inset-x-0 top-0 z-30 h-[3px] ${dark ? "bg-white/15" : "bg-ink/10"}`}
    >
      <div className="h-full origin-left bg-gold transition-transform duration-700 ease-[var(--ease-cut)]" style={{ transform: `scaleX(${v})` }} />
    </div>
  );
}

export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-nav-clear.png"
      alt={copy.brand.logoAlt}
      width={250}
      height={26}
      className={`h-[22px] w-auto ${light ? "brightness-0 invert" : ""} ${className}`}
    />
  );
}

export function PlaceholderBadge() {
  return (
    <span className="rounded-pill bg-black/45 px-3 py-1 text-[12px] font-medium text-white/85 backdrop-blur-sm">
      {copy.common.placeholderBadge}
    </span>
  );
}
