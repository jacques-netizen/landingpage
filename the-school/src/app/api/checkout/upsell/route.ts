/**
 * Post-checkout one-click upsell: charges the saved payment method for the
 * audit. Jeremy's "second page after checkout" — card on file, no re-entry.
 * The price/product lives in Stripe + env; nothing hardcoded here.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, PRICES } from "@/lib/stripe";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";

export async function POST(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await db.member.findUnique({ where: { clerkUserId: userId } });
  if (!member?.stripeCustomerId) return NextResponse.json({ error: "No customer" }, { status: 400 });

  const price = await stripe.prices.retrieve(PRICES.upsellAudit);
  const pms = await stripe.paymentMethods.list({ customer: member.stripeCustomerId, type: "card" });
  const pm = pms.data[0];
  if (!pm) return NextResponse.json({ error: "No saved card" }, { status: 400 });

  const intent = await stripe.paymentIntents.create({
    amount: price.unit_amount!,
    currency: price.currency,
    customer: member.stripeCustomerId,
    payment_method: pm.id,
    off_session: true,
    confirm: true,
    metadata: { memberId: member.id, kind: "upsell_audit" },
  });

  if (intent.status === "succeeded") {
    await db.purchase.create({
      data: { memberId: member.id, stripePriceId: price.id, kind: "upsell_audit", amountCents: price.unit_amount! },
    });
    await emitEvent(member.id, "upsell_purchased", { kind: "upsell_audit" });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Payment failed" }, { status: 402 });
}
