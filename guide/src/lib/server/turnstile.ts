import "server-only";
import { config } from "./config";

/** Verifies a Turnstile token. Skipped (true) when no secret is configured. */
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  const { turnstileSecret } = config();
  if (!turnstileSecret) return true;
  if (typeof token !== "string" || !token || token.length > 4096) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: turnstileSecret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
