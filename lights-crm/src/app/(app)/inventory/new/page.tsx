import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/inventory/product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Add Product</h1>
        <p className="text-sm text-muted-foreground">Add a new item to your inventory.</p>
      </div>
      <ProductForm categories={categories ?? []} suppliers={suppliers ?? []} />
    </div>
  );
}
