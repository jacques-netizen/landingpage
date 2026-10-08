import "server-only";
import crypto from "node:crypto";
import { config } from "./config";

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");

const sign = (payload: string, purpose: string) =>
  crypto.createHmac("sha256", config().appSecret).update(`${purpose}:${payload}`).digest("base64url").slice(0, 32);

/** A signed, long lived token: base64url(payload).signature */
export function signToken(payload: string, purpose: string): string {
  const p = Buffer.from(payload).toString("base64url");
  return `${p}.${sign(p, purpose)}`;
}

export function verifyToken(token: string | null | undefined, purpose: string): string | null {
  if (!token || typeof token !== "string" || token.length > 300) return null;
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  const expected = sign(p, purpose);
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(p, "base64url").toString();
  } catch {
    return null;
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "";
  return `${user.slice(0, 1)}${"*".repeat(Math.max(1, Math.min(4, user.length - 1)))}@${domain}`;
}
