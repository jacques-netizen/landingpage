"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";

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
    <div className="mt-8 space-y-6">
      {schools.length > 0 && (
        <div>
          <p className="text-sm font-medium">Track</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {schools.map((s) => (
              <button
                key={s.slug}
                onClick={() => setSchoolSlug(s.slug)}
                className={`rounded-lg border p-4 text-left ${schoolSlug === s.slug ? "border-black" : "opacity-70"}`}
              >
                <span className="font-medium">{s.name}</span>
                {s.tagline && <p className="mt-1 text-sm opacity-70">{s.tagline}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium">Billing</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setPlan("monthly")}
            className={`rounded-lg border px-4 py-2 text-sm ${plan === "monthly" ? "border-black" : "opacity-70"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPlan("annual")}
            className={`rounded-lg border px-4 py-2 text-sm ${plan === "annual" ? "border-black" : "opacity-70"}`}
          >
            Annual
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withBump} onChange={(e) => setWithBump(e.target.checked)} />
        Add the Vault (one-time add-on)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <SignedOut>
        <SignUpButton mode="modal" forceRedirectUrl="/join">
          <button className="w-full rounded-lg bg-black px-6 py-3 text-white">
            Create your account to continue
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <button
          onClick={checkout}
          disabled={busy || !schoolSlug}
          className="w-full rounded-lg bg-black px-6 py-3 text-white disabled:opacity-40"
        >
          {busy ? "Redirecting..." : "Continue to checkout"}
        </button>
      </SignedIn>
    </div>
  );
}
