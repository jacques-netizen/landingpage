/**
 * Presentational only. Swap this file for a redesigned version — the
 * Clerk auth state components (SignedIn/SignedOut/UserButton) are the only
 * non-visual piece and can stay as-is regardless of the surrounding markup.
 */
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <Link href="/" className="font-semibold">
        The School
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <SignedIn>
          <Link href="/dashboard">Dashboard</Link>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <Link href="/join">Join</Link>
          <SignInButton mode="modal">
            <button>Sign in</button>
          </SignInButton>
        </SignedOut>
      </nav>
    </header>
  );
}
