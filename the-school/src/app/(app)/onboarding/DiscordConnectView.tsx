/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch; the actual OAuth flow lives behind /api/discord/connect.
 */
import Link from "next/link";
import { Caption } from "@/components/Caption";

export function DiscordConnectView({
  discordConnected,
  error,
}: {
  discordConnected: boolean;
  error?: "error" | "taken";
}) {
  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-xl px-6 py-20">
        <Caption>Enrollment</Caption>
        <h1 className="mt-3.5 font-display text-[36px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[48px]">
          Connect Discord.
        </h1>
        <p className="mt-4 text-cream/70">
          Your Discord role is granted automatically once your membership is active. Link your account now so it's ready.
        </p>
        {error === "error" && <p className="mt-4 text-sm text-rouge">Something went wrong connecting Discord. Try again.</p>}
        {error === "taken" && <p className="mt-4 text-sm text-rouge">That Discord account is already linked to another member.</p>}
        {discordConnected ? (
          <p className="mt-8 rounded-[2px] border border-gold/30 bg-gold/[0.06] p-4 text-sm text-gold-bright">Discord connected.</p>
        ) : (
          <a
            href="/api/discord/connect"
            className="mt-8 inline-block rounded-[2px] border border-gold bg-gold px-6 py-3 font-body text-sm font-semibold text-ink transition-colors hover:bg-gold-bright"
          >
            Connect Discord
          </a>
        )}
        <div className="mt-10">
          <Link
            href="/join"
            className="inline-block rounded-[2px] border border-cream-bright/50 px-6 py-3 font-body text-sm font-semibold text-cream-bright transition-colors hover:border-cream-bright hover:bg-cream-bright hover:text-ink"
          >
            Continue to plans
          </Link>
        </div>
      </div>
    </main>
  );
}
