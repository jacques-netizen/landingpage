import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Plus, ClipboardList } from "lucide-react";
import { OrderStatus, SaleChannel } from "@/types";

const statusVariant: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  pending: "secondary",
  confirmed: "outline",
  in_progress: "warning",
  ready: "default",
  delivered: "success",
  cancelled: "destructive",
};

const channelLabel: Record<SaleChannel, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  b2b: "B2B",
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">{orders?.length ?? 0} orders</p>
        </div>
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>

      {!orders?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ClipboardList className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No orders yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Channel</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{order.order_number}</td>
                  <td className="px-4 py-3">{order.customers?.name ?? "Walk-in"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{channelLabel[order.channel as SaleChannel]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[order.status as OrderStatus]}>
                      {order.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/orders/${order.id}`}>View</Link>
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
