"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-8 shadow-md">
          <div className="mb-8 flex flex-col items-center gap-3">
            {/* 3D glossy ball logo */}
            <svg viewBox="0 0 56 56" width="56" height="56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="lball" cx="38%" cy="32%" r="62%">
                  <stop offset="0%" stopColor="#FF4D55" />
                  <stop offset="45%" stopColor="#E01622" />
                  <stop offset="100%" stopColor="#6B0009" />
                </radialGradient>
                <radialGradient id="lgloss" cx="35%" cy="28%" r="45%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="28" cy="28" r="28" fill="url(#lball)" />
              <circle cx="28" cy="28" r="28" fill="url(#lgloss)" />
              <circle cx="28" cy="28" r="17" fill="white" />
              <text
                x="28" y="34"
                textAnchor="middle"
                fill="#1B1714"
                fontSize="14"
                fontWeight="700"
                fontFamily="var(--font-oswald), Arial, sans-serif"
                letterSpacing="0.5"
              >
                17
              </text>
            </svg>

            <div className="text-center">
              <h1
                className="text-foreground"
                style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: "26px", fontWeight: 600 }}
              >
                17 Prime Home
              </h1>
              <p
                className="uppercase tracking-widest"
                style={{ fontFamily: "var(--font-oswald), Arial, sans-serif", fontSize: "8px", color: "#E01622", letterSpacing: "0.2em" }}
              >
                Accra · Ghana
              </p>
            </div>

            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full text-white font-semibold"
              disabled={loading}
              style={{ background: "linear-gradient(100deg,#E01622,#9C0A13)", boxShadow: "0 2px 12px rgba(224,22,34,0.3)" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
