"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Trash2, Search } from "lucide-react";

interface POLine {
  id: string;
  product_id: string | null;
  description: string;
  qty: number;
  unit_cost: number;
}

interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; cost_price?: number; }

interface POFormProps {
  suppliers: Supplier[];
  products: Product[];
  userId: string;
}

function generateId() { return Math.random().toString(36).slice(2); }

export function POForm({ suppliers, products, userId }: POFormProps) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("ordered");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedArrival, setExpectedArrival] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  function addLine(product: Product) {
    const existing = lines.find((l) => l.product_id === product.id);
    if (existing) {
      setLines((prev) => prev.map((l) => l.product_id === product.id ? { ...l, qty: l.qty + 1 } : l));
    } else {
      setLines((prev) => [...prev, {
        id: generateId(),
        product_id: product.id,
        description: product.name,
        qty: 1,
        unit_cost: product.cost_price ?? 0,
      }]);
    }
  }

  function updateLine(id: string, field: keyof POLine, value: string | number) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) { setError("Add at least one product."); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        supplier_id: supplierId || null,
        status,
        order_date: orderDate || null,
        expected_arrival: expectedArrival || null,
        notes: notes || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (poErr) { setError(poErr.message); setSaving(false); return; }

    const { error: itemsErr } = await supabase.from("purchase_order_items").insert(
      lines.map((l) => ({
        po_id: po.id,
        product_id: l.product_id,
        description: l.description,
        qty: l.qty,
        unit_cost: l.unit_cost,
      }))
    );
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }

    router.push(`/purchase-orders/${po.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="in_transit">In transit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="po-date">Order date</Label>
          <Input id="po-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po-eta">Expected arrival</Label>
          <Input id="po-eta" type="date" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Add products</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products to add…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" />
        </div>
        {productSearch && (
          <div className="rounded-lg border bg-card divide-y max-h-48 overflow-y-auto">
            {filteredProducts.slice(0, 8).map((p) => (
              <button key={p.id} type="button" onClick={() => { addLine(p); setProductSearch(""); }}
                className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-accent text-left">
                <span>{p.name}</span>
                <span className="text-muted-foreground ml-4">cost {formatCurrency(p.cost_price ?? 0)}</span>
              </button>
            ))}
            {!filteredProducts.length && <p className="px-3 py-2 text-sm text-muted-foreground">No products found.</p>}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Unit cost</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Total</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{line.description}</td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="1" value={line.qty} onChange={(e) => updateLine(line.id, "qty", parseInt(e.target.value) || 1)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="0" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(line.id, "unit_cost", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.qty * line.unit_cost)}</td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => removeLine(line.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-3 py-2 text-right font-semibold">PO Total (cost)</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="po-notes">Notes</Label>
        <Textarea id="po-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shipping terms, container ref, broker notes…" rows={2} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving || !lines.length}>{saving ? "Creating…" : "Create PO"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
