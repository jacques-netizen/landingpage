import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusStepper } from "@/components/orders/order-status-stepper";
import { CancelOrderButton } from "@/components/orders/cancel-order-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OrderStatus, SaleChannel } from "@/types";
import { ArrowLeft, FileText, User, Calendar, MessageSquare } from "lucide-react";

const channelLabel: Record<SaleChannel, string> = {
  walk_in: "Walk-in", phone: "Phone", whatsapp: "WhatsApp", b2b: "B2B",
};

const statusVariant: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  pending: "secondary",
  confirmed: "outline",
  in_progress: "warning",
  ready: "default",
  delivered: "success",
  cancelled: "destructive",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: linkedInvoice }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(name, company_name, phone, whatsapp), profiles(full_name), order_items(*, products(name, sku))")
      .eq("id", id)
      .single(),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total")
      .eq("order_id", id)
      .maybeSingle(),
  ]);

  if (!order) notFound();

  const customer = order.customers as any;
  const items = order.order_items as any[];
  const orderTotal = items.reduce((s: number, i: any) => s + i.qty * i.unit_price * (1 - i.discount_pct / 100), 0);

  // Build invoice prefill URL from order items
  const invoiceParams = new URLSearchParams({ order_id: id });

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/orders"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{order.order_number}</h1>
            <Badge variant={statusVariant[order.status as OrderStatus]}>
              {order.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline">{channelLabel[order.channel as SaleChannel]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {linkedInvoice ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/invoices/${linkedInvoice.id}`}>
                <FileText className="h-4 w-4" />
                View Invoice ({linkedInvoice.invoice_number})
              </Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href={`/invoices/new?${invoiceParams}`}>
                <FileText className="h-4 w-4" />
                Create Invoice
              </Link>
            </Button>
          )}
          {order.status !== "cancelled" && (
            <CancelOrderButton
              orderId={order.id}
              orderNumber={order.order_number}
              hasInvoice={!!linkedInvoice}
            />
          )}
        </div>
      </div>

      {/* Status stepper */}
      {order.status !== "cancelled" && (
        <Card>
          <CardContent className="py-5 overflow-x-auto">
            <OrderStatusStepper orderId={order.id} currentStatus={order.status as OrderStatus} />
          </CardContent>
        </Card>
      )}

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-wide mb-2">
              <User className="h-3.5 w-3.5" />Customer
            </div>
            {customer ? (
              <>
                <Link href={`/customers/${order.customer_id}`} className="font-medium hover:underline">
                  {customer.name}
                </Link>
                {customer.company_name && <p className="text-muted-foreground">{customer.company_name}</p>}
                {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
                {customer.whatsapp && <p className="text-muted-foreground">WhatsApp: {customer.whatsapp}</p>}
              </>
            ) : (
              <p className="text-muted-foreground">Walk-in customer</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-wide mb-2">
              <Calendar className="h-3.5 w-3.5" />Dates
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(order.created_at)}</span>
            </div>
            {order.expected_delivery && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected delivery</span>
                <span>{formatDate(order.expected_delivery)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created by</span>
              <span>{(order.profiles as any)?.full_name ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <div>
        <h2 className="text-base font-semibold mb-3">Items</h2>
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Disc%</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{item.products?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{item.products?.sku ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{item.qty}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{item.discount_pct > 0 ? `${item.discount_pct}%` : "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.qty * item.unit_price * (1 - item.discount_pct / 100))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={5} className="px-4 py-2 text-right font-semibold">Total (excl. VAT)</td>
                <td className="px-4 py-2 text-right font-semibold">{formatCurrency(orderTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {order.notes && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-wide mb-2">
              <MessageSquare className="h-3.5 w-3.5" />Notes
            </div>
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
