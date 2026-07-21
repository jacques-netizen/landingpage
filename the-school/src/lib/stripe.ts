import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Offer configuration lives in env + Stripe metadata, never hardcoded amounts.
 * Add/change offers by creating prices in Stripe and updating env — no code edits.
 */
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,       // membership, monthly
  annual: process.env.STRIPE_PRICE_ANNUAL!,         // membership, annual
  bump: process.env.STRIPE_PRICE_BUMP!,             // Vault one-time, checkout add-on
  upsellAudit: process.env.STRIPE_PRICE_AUDIT!,     // Launch Audit, post-checkout one-click
};
