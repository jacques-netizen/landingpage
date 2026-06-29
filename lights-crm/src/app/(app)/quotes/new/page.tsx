import { createClient } from "@/lib/supabase/server";
import { QuoteBuilder } from "@/components/quotes/quote-builder";

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase.from("customers").select("id, name, company_name").order("name"),
    supabase.from("products").select("id, name, unit_price").order("name"),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">New quote</h1>
      <QuoteBuilder customers={customers ?? []} products={products ?? []} userId={user!.id} />
    </div>
  );
}
