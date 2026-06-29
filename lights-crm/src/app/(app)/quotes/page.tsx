import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuoteStatus } from "@/types";
import { Plus, FileSpreadsheet } from "lucide-react";

const statusVariant: Record<QuoteStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "secondary", sent: "outline", accepted: "success", declined: "destructive", expired: "warning", converted: "default",
};
const statusLabel: Record<QuoteStatus, string> = {
  draft: "Draft", sent: "Sent", accepted: "Accepted", declined: "Declined", expired: "Expired", converted: "Converted",
};

export default async function QuotesPage() {
  const supabase = await createClient();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quotes</h1>
          <p className="text-sm text-muted-foreground">{quotes?.length ?? 0} quotations</p>
        </div>
        <Button asChild>
          <Link href="/quotes/new"><Plus className="h-4 w-4" />New Quote</Link>
        </Button>
      </div>

      {!quotes?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No quotes yet. Create a quotation for a designer or trade customer.</p>
            <Button asChild><Link href="/quotes/new">New Quote</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Quote #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => (
                <tr key={q.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{q.quote_number}</td>
                  <td className="px-4 py-3">{q.customers?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(q.created_at)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(q.total)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[q.status as QuoteStatus]}>{statusLabel[q.status as QuoteStatus]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild><Link href={`/quotes/${q.id}`}>View</Link></Button>
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
