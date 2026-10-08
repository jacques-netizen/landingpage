import "server-only";
import crypto from "node:crypto";

/** Cal.com signs webhook bodies: hex HMAC SHA-256 in x-cal-signature-256. */
export function verifyCalSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(signature.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

