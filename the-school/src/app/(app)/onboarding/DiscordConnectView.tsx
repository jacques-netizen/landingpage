/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch; the actual OAuth flow lives behind /api/discord/connect.
 */
import Link from "next/link";

export function DiscordConnectView({
  discordConnected,
  error,
}: {
  discordConnected: boolean;
  error?: "error" | "taken";
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Connect Discord</h1>
      <p className="mt-3 opacity-80">
        Your Discord role is granted automatically once your membership is active. Link your account now so it's ready.
      </p>
      {error === "error" && (
        <p className="mt-4 text-sm text-red-600">Something went wrong connecting Discord. Try again.</p>
      )}
      {error === "taken" && (
        <p className="mt-4 text-sm text-red-600">That Discord account is already linked to another member.</p>
      )}
      {discordConnected ? (
        <p className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm">Discord connected.</p>
      ) : (
        <a href="/api/discord/connect" className="mt-6 inline-block rounded-lg bg-black px-6 py-3 text-white">
          Connect Discord
        </a>
      )}
      <div className="mt-8">
        <Link href="/join" className="rounded-lg bg-black px-6 py-3 text-white">
          Continue to plans
        </Link>
      </div>
    </main>
  );
}
