/**
 * Public pricing/join page. School list is data-driven; the plan/bump copy
 * describes the Stripe offer shape, not curriculum content, so it's fine here.
 * Actual prices are never shown as hardcoded numbers — Stripe Checkout shows them.
 */
import { db } from "@/lib/db";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const schools = await db.school.findMany({
    where: { archived: false },
    orderBy: { order: "asc" },
    select: { slug: true, name: true, tagline: true },
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Join The School</h1>
      <p className="mt-3 opacity-80">
        Pick your track and plan. You'll choose monthly or annual billing on the
        next step, and can add the Vault at checkout.
      </p>
      <JoinForm schools={schools} />
    </main>
  );
}
