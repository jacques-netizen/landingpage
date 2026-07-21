import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = { title: "The School" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
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
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
