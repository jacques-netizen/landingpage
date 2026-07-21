"use client";
/**
 * Post-checkout upsell client. Copy comes from env-driven config later or is
 * edited here freely — the CHARGE mechanics live in the API, prices in Stripe.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold">You&apos;re in. One more thing.</h1>
      <p className="mt-4 opacity-80">
        Add the Launch Audit: a 1:1 call and a personal 90-day plan for your exact situation.
        Charged to the card you just used — one click.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button onClick={buy} disabled={busy} className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-40">
          Add the Launch Audit
        </button>
        <button onClick={() => router.push("/dashboard")} className="rounded-lg border px-6 py-3">
          No thanks, take me in
        </button>
      </div>
    </main>
  );
}
