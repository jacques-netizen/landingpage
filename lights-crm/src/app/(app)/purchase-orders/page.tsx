import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { PurchaseOrderStatus } from "@/types";
import { Plus, Truck } from "lucide-react";

const statusVariant: Record<PurchaseOrderStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "secondary",
  ordered: "outline",
  in_transit: "warning",
  received: "success",
  cancelled: "destructive",
};

const statusLabel: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  ordered: "Ordered",
  in_transit: "In transit",
  received: "Received",
  cancelled: "Cancelled",
};

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();

  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchasing</h1>
          <p className="text-sm text-muted-foreground">{pos?.length ?? 0} purchase orders</p>
        </div>
        <Button asChild>
          <Link href="/purchase-orders/new">
            <Plus className="h-4 w-4" />
            New PO
          </Link>
        </Button>
      </div>

      {!pos?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Truck className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No purchase orders yet. Create one to track an order from a supplier.</p>
            <Button asChild><Link href="/purchase-orders/new">New PO</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">PO #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ordered</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expected</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po: any) => (
                <tr key={po.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{po.po_number}</td>
                  <td className="px-4 py-3">{po.suppliers?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{po.order_date ? formatDate(po.order_date) : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{po.expected_arrival ? formatDate(po.expected_arrival) : "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[po.status as PurchaseOrderStatus]}>
                      {statusLabel[po.status as PurchaseOrderStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/purchase-orders/${po.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
