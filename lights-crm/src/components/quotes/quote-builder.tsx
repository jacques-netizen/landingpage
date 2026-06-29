"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Search } from "lucide-react";

interface LineItem {
  id: string;
  product_id?: string;
  description: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
}

interface Customer { id: string; name: string; company_name?: string; }
interface Product { id: string; name: string; unit_price: number; }

interface QuoteBuilderProps {
  customers: Customer[];
  products: Product[];
  userId: string;
}

const TAX_RATE = 12.5;

function generateId() { return Math.random().toString(36).slice(2); }
function emptyLine(): LineItem {
  return { id: generateId(), description: "", qty: 1, unit_price: 0, discount_pct: 0 };
}

export function QuoteBuilder({ customers, products, userId }: QuoteBuilderProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(TAX_RATE);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState("");

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.company_name ?? "").toLowerCase().includes(q);
  });

  function addLine() { setLines((l) => [...l, emptyLine()]); }
  function removeLine(id: string) { setLines((l) => l.filter((x) => x.id !== id)); }
  function updateLine(id: string, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }
  function fillFromProduct(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setLines((prev) => prev.map((l) =>
      l.id === lineId ? { ...l, product_id: product.id, description: product.name, unit_price: product.unit_price } : l
    ));
  }

  const lineTotal = (l: LineItem) => l.qty * l.unit_price * (1 - l.discount_pct / 100);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const discountTotal = lines.reduce((s, l) => s + l.qty * l.unit_price * (l.discount_pct / 100), 0);
  const taxTotal = subtotal * (taxRate / 100);
  const total = subtotal + taxTotal;

  async function save(status: "draft" | "sent") {
    if (!customerId) { setError("Please select a customer."); return; }
    if (!lines.some((l) => l.description.trim())) { setError("Add at least one line item."); return; }
    setSaving(status === "draft" ? "draft" : "send");
    setError("");

    const supabase = createClient();
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .insert({
        customer_id: customerId,
        status,
        valid_until: validUntil || null,
        subtotal: subtotal + discountTotal,
        discount_total: discountTotal,
        tax_rate: taxRate,
        tax_total: taxTotal,
        total,
        notes: notes || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (qErr) { setError(qErr.message); setSaving(null); return; }

    await supabase.from("quote_items").insert(
      lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          quote_id: quote.id,
          product_id: l.product_id ?? null,
          description: l.description,
          qty: l.qty,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          line_total: lineTotal(l),
        }))
    );

    router.push(`/quotes/${quote.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1.5">
        <Label>Customer *</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customer…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {filteredCustomers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}{c.company_name ? ` — ${c.company_name}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="valid_until">Valid until</Label>
          <Input id="valid_until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tax_rate">VAT Rate (%)</Label>
          <Input id="tax_rate" type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Line Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4" />Add Line</Button>
        </div>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[35%]">Description</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Unit</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">Disc%</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Total</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-2 py-1.5">
                    <Input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} placeholder="Description…" className="h-7 text-xs" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select onValueChange={(v) => fillFromProduct(line.id, v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pick…" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="1" value={line.qty} onChange={(e) => updateLine(line.id, "qty", parseFloat(e.target.value) || 1)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(line.id, "unit_price", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="0" max="100" value={line.discount_pct} onChange={(e) => updateLine(line.id, "discount_pct", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-xs">{formatCurrency(lineTotal(line))}</td>
                  <td className="px-2 py-1.5">
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(line.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal (excl. discount)</span><span>{formatCurrency(subtotal + discountTotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span><span className="text-red-500">-{formatCurrency(discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>VAT {taxRate}%</span><span>{formatCurrency(taxTotal)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span><span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scope, lead time, terms, validity…" rows={2} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={() => save("sent")} disabled={!!saving}>{saving === "send" ? "Saving…" : "Save & Mark Sent"}</Button>
        <Button variant="outline" onClick={() => save("draft")} disabled={!!saving}>{saving === "draft" ? "Saving…" : "Save as Draft"}</Button>
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  );
}
