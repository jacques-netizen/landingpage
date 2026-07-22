"use client";
/**
 * Post-checkout upsell client. Copy comes from env-driven config later or is
 * edited here freely — the CHARGE mechanics live in the API, prices in Stripe.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Caption } from "@/components/Caption";

export function UpsellClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    const res = await fetch("/api/checkout/upsell", { method: "POST" });
    setBusy(false);
    router.push(res.ok ? "/dashboard?welcome=1" : "/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center bg-ink pt-[76px]">
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <Caption>You&apos;re in</Caption>
        <h1 className="mt-3.5 font-display text-[36px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[44px]">
          One more thing.
        </h1>
        <p className="mt-5 text-cream/72">
          Add the Launch Audit: a 1:1 call and a personal 90-day plan for your exact situation.
          Charged to the card you just used — one click.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <button
            onClick={buy}
            disabled={busy}
            className="rounded-[2px] border border-gold bg-gold px-6 py-3.5 font-body text-sm font-semibold text-ink transition-colors hover:bg-gold-bright disabled:opacity-40"
          >
            Add the Launch Audit
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-[2px] border border-cream/20 px-6 py-3.5 font-body text-sm text-cream/75 transition-colors hover:border-cream/40"
          >
            No thanks, take me in
          </button>
        </div>
      </div>
    </main>
  );
}
