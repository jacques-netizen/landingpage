"use client";
// Last resort for the owner's dashboard: never a blank error page.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1 className="font-serif text-subtitle">The dashboard hit an error.</h1>
      <p className="mt-4 text-[15px] text-muted">
        Reference {error.digest ?? "none"}. The same reference is in the Vercel function logs with the full message.
      </p>
      <button type="button" onClick={reset} className="mt-8 h-12 rounded-pill bg-ink px-7 text-[15px] font-medium text-white">
        Try again
      </button>
    </main>
  );
}
