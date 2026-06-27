import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatus } from "@/types";
import { ArrowLeft, Printer } from "lucide-react";

const statusVariant: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "secondary", sent: "outline", partially_paid: "warning", paid: "success", overdue: "destructive",
};

const paymentMethodLabel: Record<string, string> = {
  cash: "Cash", card: "Card", bank_transfer: "Bank Transfer",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, customers(id, name, company_name, phone, whatsapp, email, address), invoice_items(*, products(name))")
      .eq("id", id)
      .single(),
    supabase
      .from("payments")
      .select("*, profiles(full_name)")
      .eq("invoice_id", id)
      .order("paid_at", { ascending: false }),
  ]);

  if (!invoice) notFound();

  const outstanding = invoice.total - invoice.amount_paid;
  const customer = invoice.customers as any;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{invoice.invoice_number}</h1>
            <Badge variant={statusVariant[invoice.status as InvoiceStatus]}>
              {invoice.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(invoice.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {}} className="print:hidden">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          {outstanding > 0 && (
            <RecordPaymentDialog invoiceId={invoice.id} outstanding={outstanding} userId={user!.id} />
          )}
        </div>
      </div>

      {/* Invoice document */}
      <Card>
        <CardContent className="p-8 space-y-6">
          {/* Customer */}
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bill To</p>
              <p className="font-semibold">{customer?.name}</p>
              {customer?.company_name && <p className="text-sm text-muted-foreground">{customer.company_name}</p>}
              {customer?.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              {customer?.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
              {customer?.address && <p className="text-sm text-muted-foreground whitespace-pre-line">{customer.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Invoice</p>
              <p className="font-mono font-semibold">{invoice.invoice_number}</p>
              <p className="text-sm text-muted-foreground">Date: {formatDate(invoice.created_at)}</p>
              {invoice.due_date && (
                <p className="text-sm text-muted-foreground">Due: {formatDate(invoice.due_date)}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-16">Qty</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-24">Unit €</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-16">Disc%</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.invoice_items as any[]).map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right">{item.qty}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 text-right text-muted-foreground">{item.discount_pct > 0 ? `${item.discount_pct}%` : "—"}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-56 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount_total > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span><span className="text-red-500">-{formatCurrency(invoice.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>VAT {invoice.tax_rate}%</span><span>{formatCurrency(invoice.tax_total)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span><span>{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Paid</span><span>-{formatCurrency(invoice.amount_paid)}</span>
                </div>
              )}
              {outstanding > 0 && (
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Outstanding</span><span>{formatCurrency(outstanding)}</span>
                </div>
              )}
            </div>
          </div>

          {invoice.notes && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      {!!payments?.length && (
        <div>
          <h2 className="text-base font-semibold mb-3">Payments</h2>
          <div className="rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(p.paid_at)}</td>
                    <td className="px-4 py-2">{paymentMethodLabel[p.method]}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.reference ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-medium text-green-600">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.profiles?.full_name ?? "—"}</td>
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
