"use client";
/**
 * École chrome. Fixed, transparent over the cinematic hero, solidifying to a
 * blurred bar once you scroll past it. The É is the signature glyph
 * (design study §5). Auth state comes from Clerk's own client components, so
 * this stays a pure client island with no server round-trip.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-[70px] items-center justify-between px-6 transition-[background,border-color,backdrop-filter] duration-300 sm:px-11"
      style={{
        background: scrolled ? "rgba(13,15,13,0.82)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(232,230,221,0.1)" : "1px solid transparent",
      }}
    >
      <Link href="/" className="flex items-baseline gap-0">
        <span className="font-display text-[32px] leading-[0.8] text-gold">É</span>
        <span className="font-display text-[18px] tracking-[0.03em] text-cream-bright">cole</span>
      </Link>
      <nav className="flex items-center gap-6 sm:gap-8">
        <SignedIn>
          <Link href="/dashboard" className="font-body text-[13px] tracking-[0.03em] text-cream/70 hover:text-cream-bright">
            Dashboard
          </Link>
          <Link href="/register" className="font-body text-[13px] tracking-[0.03em] text-cream/70 hover:text-cream-bright">
            Register
          </Link>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="font-body text-[13px] tracking-[0.03em] text-cream/70 hover:text-cream-bright">
              Sign in
            </button>
          </SignInButton>
          <Link
            href="/join"
            className="rounded-[2px] bg-gold px-5 py-2.5 font-body text-[13px] font-bold tracking-[0.02em] text-ink transition-colors hover:bg-gold-bright"
          >
            Enter École →
          </Link>
        </SignedOut>
      </nav>
    </header>
  );
}
