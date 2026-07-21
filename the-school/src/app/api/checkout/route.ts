/**
 * Creates a Stripe Checkout session: membership subscription + optional bump
 * (one-time add-on line item). Amounts live in Stripe; this route only wires
 * price IDs from env. New offers = new prices in Stripe + env, no code edits.
 */
import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICES } from "@/lib/stripe";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { ensureMember } from "@/lib/member";

export async function POST(req: NextRequest) {
  const { plan = "monthly", withBump = false, schoolSlug } = await req.json();

  const member = await ensureMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // School choice at checkout (switchable later — nothing assumes it's fixed)
  if (schoolSlug) {
    const school = await db.school.findUnique({ where: { slug: schoolSlug } });
    if (school) await db.member.update({ where: { id: member.id }, data: { schoolId: school.id } });
  }

  const lineItems: { price: string; quantity: number }[] = [
    { price: plan === "annual" ? PRICES.annual : PRICES.monthly, quantity: 1 },
  ];
  if (withBump) lineItems.push({ price: PRICES.bump, quantity: 1 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: member.stripeCustomerId ?? undefined,
    customer_email: member.stripeCustomerId ? undefined : member.email,
    line_items: lineItems,
    metadata: { memberId: member.id },
    subscription_data: { metadata: { memberId: member.id } },
    // Post-checkout upsell page (the $297 audit, card on file, one click)
    success_url: `${process.env.APP_URL}/checkout/upsell?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/join`,
  });

  await emitEvent(member.id, "checkout_started", { plan, withBump });
  return NextResponse.json({ url: session.url });
}
