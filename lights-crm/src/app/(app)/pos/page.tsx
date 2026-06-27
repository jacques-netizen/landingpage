import { createClient } from "@/lib/supabase/server";
import { POSTerminal } from "@/components/pos/pos-terminal";

export default async function POSPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: allProducts } = await supabase
    .from("products")
    .select("id, sku, name, unit_price, stock_qty, is_custom_order")
    .order("name");

  return (
    <POSTerminal
      products={(allProducts ?? []) as any[]}
      userId={user!.id}
    />
  );
}
