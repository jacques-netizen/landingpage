import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PackageCheck } from "lucide-react";

export default async function ReorderPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, stock_qty, warehouse_qty, low_stock_threshold, is_custom_order, suppliers(name, phone)")
    .eq("is_custom_order", false)
    .order("stock_qty");

  // Items at or below their per-SKU reorder point (total on-hand).
  const reorder = (products ?? []).filter(
    (p: any) => p.stock_qty + (p.warehouse_qty ?? 0) <= p.low_stock_threshold
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inventory"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Reorder list</h1>
          <p className="text-sm text-muted-foreground">
            {reorder.length} item{reorder.length === 1 ? "" : "s"} at or below their reorder point. Order ahead — sea-freight lead times are long.
          </p>
        </div>
      </div>

      {!reorder.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <PackageCheck className="h-10 w-10 text-green-500" />
            <p className="text-muted-foreground">Everything is above its reorder point. Nothing to order right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">On hand</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Reorder at</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reorder.map((p: any) => {
                const onHand = p.stock_qty + (p.warehouse_qty ?? 0);
                const isOut = onHand <= 0;
                const supplier = p.suppliers as any;
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {supplier?.name ?? "—"}
                      {supplier?.phone && <div className="text-xs">{supplier.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{onHand}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{p.low_stock_threshold}</td>
                    <td className="px-4 py-3">
                      {isOut ? <Badge variant="destructive">Out of stock</Badge> : <Badge variant="warning">Low</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/inventory/${p.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
