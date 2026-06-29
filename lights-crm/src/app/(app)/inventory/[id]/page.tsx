import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/inventory/product-form";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog";
import { TransferStockDialog } from "@/components/inventory/transfer-stock-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: suppliers }, { data: adjustments }] = await Promise.all([
    supabase.from("products").select("*, categories(name), suppliers(name)").eq("id", id).single(),
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("stock_adjustments")
      .select("*, profiles(full_name)")
      .eq("product_id", id)
      .order("adjusted_at", { ascending: false })
      .limit(20),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
          <div className="mt-2 flex gap-4 text-sm">
            <span><span className="text-muted-foreground">Showroom</span> <span className="font-semibold">{product.stock_qty}</span></span>
            <span><span className="text-muted-foreground">Warehouse</span> <span className="font-semibold">{product.warehouse_qty ?? 0}</span></span>
            <span><span className="text-muted-foreground">On hand</span> <span className="font-semibold">{product.stock_qty + (product.warehouse_qty ?? 0)}</span></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StockAdjustDialog
            productId={product.id}
            productName={product.name}
            currentStock={product.stock_qty}
          />
          <TransferStockDialog
            productId={product.id}
            productName={product.name}
            showroomQty={product.stock_qty}
            warehouseQty={product.warehouse_qty ?? 0}
          />
          <ReceiveStockDialog
            productId={product.id}
            productName={product.name}
            currentStock={product.stock_qty}
            warehouseQty={product.warehouse_qty ?? 0}
            currentCost={product.cost_price ?? 0}
          />
        </div>
      </div>

      <ProductForm categories={categories ?? []} suppliers={suppliers ?? []} product={product} />

      {!!adjustments?.length && (
        <div>
          <h2 className="text-base font-semibold mb-3">Stock Adjustment History</h2>
          <div className="rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Change</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">By</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(a.adjusted_at)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={a.qty_change > 0 ? "success" : "destructive"}>
                        {a.qty_change > 0 ? "+" : ""}{a.qty_change}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{a.reason}</td>
                    <td className="px-4 py-2 text-muted-foreground">{(a.profiles as any)?.full_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
