import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReceivePOButton } from "@/components/purchasing/receive-po-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PurchaseOrderStatus } from "@/types";
import { ArrowLeft, Truck, Calendar } from "lucide-react";

const statusVariant: Record<PurchaseOrderStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "secondary", ordered: "outline", in_transit: "warning", received: "success", cancelled: "destructive",
};
const statusLabel: Record<PurchaseOrderStatus, string> = {
  draft: "Draft", ordered: "Ordered", in_transit: "In transit", received: "Received", cancelled: "Cancelled",
};

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name, phone, email), profiles(full_name), purchase_order_items(*, products(name, sku))")
    .eq("id", id)
    .single();

  if (!po) notFound();

  const supplier = po.suppliers as any;
  const items = po.purchase_order_items as any[];
  const total = items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
  const canReceive = po.status !== "received" && po.status !== "cancelled";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/purchase-orders"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{po.po_number}</h1>
            <Badge variant={statusVariant[po.status as PurchaseOrderStatus]}>
              {statusLabel[po.status as PurchaseOrderStatus]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(po.created_at)}</p>
        </div>
        {canReceive && <ReceivePOButton poId={po.id} poNumber={po.po_number} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-wide mb-2">
              <Truck className="h-3.5 w-3.5" />Supplier
            </div>
            <p className="font-medium">{supplier?.name ?? "—"}</p>
            {supplier?.phone && <p className="text-muted-foreground">{supplier.phone}</p>}
            {supplier?.email && <p className="text-muted-foreground">{supplier.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-wide mb-2">
              <Calendar className="h-3.5 w-3.5" />Dates
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Order date</span><span>{po.order_date ? formatDate(po.order_date) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expected arrival</span><span>{po.expected_arrival ? formatDate(po.expected_arrival) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created by</span><span>{(po.profiles as any)?.full_name ?? "—"}</span></div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Items</h2>
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit cost</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{item.products?.name ?? item.description}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{item.products?.sku ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{item.qty}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.unit_cost)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.qty * item.unit_cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={4} className="px-4 py-2 text-right font-semibold">PO Total (cost)</td>
                <td className="px-4 py-2 text-right font-semibold">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {po.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
