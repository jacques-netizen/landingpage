import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConvertQuoteButton } from "@/components/quotes/convert-quote-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuoteStatus } from "@/types";
import { ArrowLeft, FileText } from "lucide-react";

const statusVariant: Record<QuoteStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "secondary", sent: "outline", accepted: "success", declined: "destructive", expired: "warning", converted: "default",
};

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, customers(name, company_name, phone, email, address), quote_items(*)")
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const customer = quote.customers as any;
  const items = quote.quote_items as any[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/quotes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{quote.quote_number}</h1>
            <Badge variant={statusVariant[quote.status as QuoteStatus]}>{quote.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(quote.created_at)}</p>
        </div>
        {quote.converted_invoice_id ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/${quote.converted_invoice_id}`}><FileText className="h-4 w-4" />View invoice</Link>
          </Button>
        ) : (
          <ConvertQuoteButton quoteId={quote.id} quoteNumber={quote.quote_number} />
        )}
      </div>

      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Quotation for</p>
              <p className="font-semibold">{customer?.name}</p>
              {customer?.company_name && <p className="text-sm text-muted-foreground">{customer.company_name}</p>}
              {customer?.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
              {customer?.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Quote</p>
              <p className="font-mono font-semibold">{quote.quote_number}</p>
              <p className="text-sm text-muted-foreground">Date: {formatDate(quote.created_at)}</p>
              {quote.valid_until && <p className="text-sm text-muted-foreground">Valid until: {formatDate(quote.valid_until)}</p>}
            </div>
          </div>

          <Separator />

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-16">Qty</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-24">Unit</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-16">Disc%</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
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

          <div className="flex justify-end">
            <div className="w-56 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.discount_total > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span><span className="text-red-500">-{formatCurrency(quote.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>VAT {quote.tax_rate}%</span><span>{formatCurrency(quote.tax_total)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span><span>{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
