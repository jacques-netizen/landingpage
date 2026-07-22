/**
 * École chrome: the wordmark treats the É as the signature glyph (design
 * study §5). Wing dot + nav are the only data-dependent pieces, fetched
 * here directly since the header has no natural page.tsx of its own.
 */
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { accentBgClass } from "@/lib/wing";

export async function SiteHeader() {
  const { userId } = await auth();
  const member = userId
    ? await db.member.findUnique({ where: { clerkUserId: userId }, include: { school: true } })
    : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[76px] items-center justify-between px-6 sm:px-11">
      <Link href="/" className="flex items-baseline gap-0">
        <span className="font-display text-[34px] leading-[0.8] text-gold">É</span>
        <span className="font-display text-[19px] tracking-[0.02em] text-cream-bright">cole</span>
      </Link>
      <nav className="flex items-center gap-6 sm:gap-8">
        <SignedIn>
          <Link href="/dashboard" className="font-body text-[13px] uppercase tracking-[0.05em] text-cream/70 hover:text-cream-bright">
            Dashboard
          </Link>
          <Link href="/register" className="font-body text-[13px] uppercase tracking-[0.05em] text-cream/70 hover:text-cream-bright">
            Register
          </Link>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <Link href="/join" className="font-body text-[13px] uppercase tracking-[0.05em] text-cream/70 hover:text-cream-bright">
            Join
          </Link>
          <SignInButton mode="modal">
            <button className="font-body text-[13px] uppercase tracking-[0.05em] text-cream/70 hover:text-cream-bright">
              Sign in
            </button>
          </SignInButton>
        </SignedOut>
      </nav>
      {member?.school && (
        <div className="hidden items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-cream/55 uppercase sm:flex">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${accentBgClass(member.school.slug)}`} />
          {member.school.name}
        </div>
      )}
    </header>
  );
}
