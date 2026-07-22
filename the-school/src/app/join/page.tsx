/**
 * Public pricing/join page. School list is data-driven; the plan/bump copy
 * describes the Stripe offer shape, not curriculum content, so it's fine here.
 * Actual prices are never shown as hardcoded numbers — Stripe Checkout shows them.
 */
import { db } from "@/lib/db";
import { Caption } from "@/components/Caption";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const schools = await db.school.findMany({
    where: { archived: false },
    orderBy: { order: "asc" },
    select: { slug: true, name: true, tagline: true },
  });

  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-xl px-6 py-20">
        <Caption>Enrollment</Caption>
        <h1 className="mt-3.5 font-display text-[36px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[48px]">
          Join École.
        </h1>
        <p className="mt-4 text-cream/70">
          Pick your wing and plan. You'll choose monthly or annual billing below, and can add the Vault at checkout.
        </p>
        <JoinForm schools={schools} />
      </div>
    </main>
  );
}
