/**
 * THE SPINE. Stripe webhook → Member.accessStatus → Event → (bot syncs Discord role).
 * Rules (CLAUDE.md Rule 1): signature-verified, idempotent, DB is source of truth.
 * Prices/products are configured IN STRIPE, referenced by env — never hardcoded amounts.
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: process each Stripe event exactly once.
  const seen = await db.webhookEvent.findUnique({ where: { id: event.id } });
  if (seen) return NextResponse.json({ received: true, duplicate: true });
  await db.webhookEvent.create({ data: { id: event.id } });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.memberId;
      if (!memberId) break;

      await db.member.update({
        where: { id: memberId },
        data: { stripeCustomerId: (session.customer as string) ?? undefined },
      });

      // One-time line items (the bump, the audit) → Purchase rows.
      // kind comes from Stripe price metadata ("kind": "bump" | "upsell_audit"),
      // so new offers are added in Stripe + JSON config, not in code.
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price"] });
      for (const item of lineItems.data) {
        const price = item.price as Stripe.Price | null;
        if (!price || price.recurring) continue; // subscriptions handled below
        await db.purchase.create({
          data: {
            memberId,
            stripePriceId: price.id,
            kind: (price.metadata?.kind as string) ?? "one_time",
            amountCents: item.amount_total ?? 0,
          },
        });
      }
      await emitEvent(memberId, "checkout_completed", { sessionId: session.id });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const member = await db.member.findUnique({ where: { stripeCustomerId: sub.customer as string } });
      if (!member) break;

      const plan = (sub.items.data[0]?.price.metadata?.plan as string) ?? "monthly";
      const active = sub.status === "active" || sub.status === "trialing";
      const accessStatus = active ? "active" : sub.status === "past_due" ? "past_due" : "canceled";

      await db.subscription.upsert({
        where: { stripeSubscriptionId: sub.id },
        update: { status: sub.status, plan, currentPeriodEnd: new Date(sub.current_period_end * 1000) },
        create: { memberId: member.id, stripeSubscriptionId: sub.id, status: sub.status, plan, currentPeriodEnd: new Date(sub.current_period_end * 1000) },
      });
      await db.member.update({ where: { id: member.id }, data: { accessStatus, plan } });

      // The bot polls unsynced access_changed events and grants/revokes roles.
      await emitEvent(member.id, "access_changed", { accessStatus, plan });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const member = await db.member.findUnique({ where: { stripeCustomerId: sub.customer as string } });
      if (!member) break;
      await db.subscription.updateMany({ where: { stripeSubscriptionId: sub.id }, data: { status: "canceled" } });
      await db.member.update({ where: { id: member.id }, data: { accessStatus: "canceled" } });
      await emitEvent(member.id, "access_changed", { accessStatus: "canceled" });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const member = await db.member.findUnique({ where: { stripeCustomerId: invoice.customer as string } });
      if (!member) break;
      await db.member.update({ where: { id: member.id }, data: { accessStatus: "past_due" } });
      await emitEvent(member.id, "payment_failed", { invoiceId: invoice.id });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
