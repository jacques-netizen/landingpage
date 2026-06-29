import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/orders/order-form";

export default async function NewOrderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase.from("customers").select("id, name, company_name").order("name"),
    supabase.from("products").select("id, name, unit_price, cost_price, is_custom_order").order("name"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">New Order</h1>
        <p className="text-sm text-muted-foreground">Create a sales order for tracking and fulfilment.</p>
      </div>
      <OrderForm customers={customers ?? []} products={products ?? []} userId={user!.id} />
    </div>
  );
}
