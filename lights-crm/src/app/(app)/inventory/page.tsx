import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Plus, Package } from "lucide-react";

export default async function InventoryPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*, categories(name), suppliers(name)")
    .order("name");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{products?.length ?? 0} products</p>
        </div>
        <Button asChild>
          <Link href="/inventory/new">
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      {!products?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No products yet. Add your first product.</p>
            <Button asChild>
              <Link href="/inventory/new">Add Product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: any) => {
                const isLow = product.stock_qty <= product.low_stock_threshold;
                const isOut = product.stock_qty === 0;
                return (
                  <tr key={product.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                      {product.brand && <div className="text-xs text-muted-foreground">{product.brand}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{product.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground">{product.categories?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(product.unit_price)}</td>
                    <td className="px-4 py-3 text-right">{product.stock_qty}</td>
                    <td className="px-4 py-3">
                      {isOut ? (
                        <Badge variant="destructive">Out of stock</Badge>
                      ) : isLow ? (
                        <Badge variant="warning">Low stock</Badge>
                      ) : product.is_custom_order ? (
                        <Badge variant="secondary">Custom order</Badge>
                      ) : (
                        <Badge variant="success">In stock</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/inventory/${product.id}`}>Edit</Link>
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
