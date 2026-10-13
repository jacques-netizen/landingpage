import "server-only";
import crypto from "node:crypto";
import { config } from "./config";

export const DASH_COOKIE = "mde_dash";
export const dashCookieValue = () =>
  crypto.createHmac("sha256", config().appSecret).update(`dash:${config().dashboardPassword}`).digest("base64url");

/** The configured password, with surrounding quotes or spaces (a common paste mistake in Vercel) removed. */
const configured = () => config().dashboardPassword.trim().replace(/^(["'])(.*)\1$/, "$2");

export function passwordOk(input: unknown): boolean {
  const pw = configured();
  if (!pw || typeof input !== "string") return false;
  const a = crypto.createHash("sha256").update(input.trim()).digest();
  const b = crypto.createHash("sha256").update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}
