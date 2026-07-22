"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { Caption } from "@/components/Caption";

type School = { slug: string; name: string; tagline: string | null };

export function JoinForm({ schools }: { schools: School[] }) {
  const router = useRouter();
  const [schoolSlug, setSchoolSlug] = useState(schools[0]?.slug ?? "");
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [withBump, setWithBump] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, withBump, schoolSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      router.push(data.url);
    } catch {
      setError("Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 flex flex-col gap-8">
      {schools.length > 0 && (
        <div>
          <Caption>Wing</Caption>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {schools.map((s) => (
              <button
                key={s.slug}
                onClick={() => setSchoolSlug(s.slug)}
                className={`rounded-[2px] border p-4 text-left transition-colors ${
                  schoolSlug === s.slug ? "border-gold" : "border-cream/16 hover:border-cream/30"
                }`}
              >
                <span className="font-display text-lg text-cream-bright">{s.name}</span>
                {s.tagline && <p className="mt-1 text-sm text-cream/60">{s.tagline}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Caption>Billing</Caption>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setPlan("monthly")}
            className={`rounded-[2px] border px-4 py-2 text-sm transition-colors ${
              plan === "monthly" ? "border-gold text-cream-bright" : "border-cream/16 text-cream/65 hover:border-cream/30"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPlan("annual")}
            className={`rounded-[2px] border px-4 py-2 text-sm transition-colors ${
              plan === "annual" ? "border-gold text-cream-bright" : "border-cream/16 text-cream/65 hover:border-cream/30"
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-cream/80">
        <input type="checkbox" checked={withBump} onChange={(e) => setWithBump(e.target.checked)} />
        Add the Vault (one-time add-on)
      </label>

      {error && <p className="text-sm text-rouge">{error}</p>}

      <SignedOut>
        <SignUpButton mode="modal" forceRedirectUrl="/join">
          <button className="w-full rounded-[2px] border border-gold bg-gold px-6 py-3.5 font-body text-sm font-semibold tracking-[0.02em] text-ink transition-colors hover:bg-gold-bright">
            Create your account to continue
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <button
          onClick={checkout}
          disabled={busy || !schoolSlug}
          className="w-full rounded-[2px] border border-gold bg-gold px-6 py-3.5 font-body text-sm font-semibold tracking-[0.02em] text-ink transition-colors hover:bg-gold-bright disabled:cursor-default disabled:opacity-40"
        >
          {busy ? "Redirecting…" : "Continue to checkout"}
        </button>
      </SignedIn>
    </div>
  );
}
