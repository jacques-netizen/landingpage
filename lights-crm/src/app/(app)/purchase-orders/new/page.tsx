import { createClient } from "@/lib/supabase/server";
import { POForm } from "@/components/purchasing/po-form";

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, name, cost_price").order("name"),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">New purchase order</h1>
      <POForm suppliers={suppliers ?? []} products={products ?? []} userId={user!.id} />
    </div>
  );
}
