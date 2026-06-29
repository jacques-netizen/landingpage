import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Phone, MessageCircle, Mail, MapPin, Edit, Tag } from "lucide-react";
import { InvoiceStatus } from "@/types";

const statusVariant: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "secondary", sent: "outline", partially_paid: "warning", paid: "success", overdue: "destructive", void: "secondary",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: invoices }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("invoices").select("id, invoice_number, total, amount_paid, status, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);

  if (!customer) notFound();

  const totalSpent = invoices?.reduce((s, i) => s + (i.amount_paid ?? 0), 0) ?? 0;
  const outstanding = invoices?.reduce((s, i) => s + Math.max(0, i.total - i.amount_paid), 0) ?? 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{customer.name}</h1>
            <Badge variant={customer.type === "b2b" ? "default" : "secondary"}>
              {customer.type === "b2b" ? "B2B" : "Retail"}
            </Badge>
          </div>
          {customer.company_name && (
            <p className="text-sm text-muted-foreground mt-0.5">{customer.company_name}</p>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/customers/${id}/edit`}>
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customer.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />{customer.phone}
              </div>
            )}
            {customer.whatsapp && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" />{customer.whatsapp}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />{customer.email}
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{customer.address}
              </div>
            )}
            {customer.tags?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {customer.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
            {!customer.phone && !customer.whatsapp && !customer.email && (
              <p className="text-muted-foreground">No contact info saved.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total invoices</span>
              <span className="font-medium">{invoices?.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-medium text-green-600">{formatCurrency(totalSpent)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding</span>
              <span className={`font-semibold ${outstanding > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {formatCurrency(outstanding)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p></CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Invoice History</h2>
          <Button size="sm" asChild>
            <Link href={`/invoices/new?customer_id=${id}`}>New Invoice</Link>
          </Button>
        </div>
        {!invoices?.length ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <div className="rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2 font-mono text-xs font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(inv.created_at)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-2 text-right">
                      {inv.total - inv.amount_paid > 0
                        ? <span className="text-red-600">{formatCurrency(inv.total - inv.amount_paid)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={statusVariant[inv.status as InvoiceStatus]}>{inv.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
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
    </div>
  );
}
