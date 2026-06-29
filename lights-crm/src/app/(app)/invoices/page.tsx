import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText } from "lucide-react";
import { InvoiceStatus } from "@/types";

const statusVariant: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "secondary",
  sent: "outline",
  partially_paid: "warning",
  paid: "success",
  overdue: "destructive",
  void: "secondary",
};

const statusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">{invoices?.length ?? 0} invoices</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      {!invoices?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No invoices yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{inv.customers?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.created_at)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3 text-right">
                    {inv.total - inv.amount_paid > 0
                      ? <span className="text-red-600 font-medium">{formatCurrency(inv.total - inv.amount_paid)}</span>
                      : <span className="text-green-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[inv.status as InvoiceStatus]}>
                      {statusLabel[inv.status as InvoiceStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/invoices/${inv.id}`}>View</Link>
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
