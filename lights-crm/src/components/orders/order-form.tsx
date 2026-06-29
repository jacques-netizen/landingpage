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
import { Plus, Trash2, Search } from "lucide-react";
import { SaleChannel } from "@/types";

interface OrderLine {
  id: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  cost_price: number;
  discount_pct: number;
  is_custom_order: boolean;
}

interface Customer { id: string; name: string; company_name?: string; }
interface Product { id: string; name: string; unit_price: number; cost_price?: number; is_custom_order: boolean; }

interface OrderFormProps {
  customers: Customer[];
  products: Product[];
  userId: string;
}

function generateId() { return Math.random().toString(36).slice(2); }

export function OrderForm({ customers, products, userId }: OrderFormProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [channel, setChannel] = useState<SaleChannel>("walk_in");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.company_name ?? "").toLowerCase().includes(q);
  });

  function addLine(product: Product) {
    const existing = lines.find((l) => l.product_id === product.id);
    if (existing) {
      setLines((prev) => prev.map((l) => l.product_id === product.id ? { ...l, qty: l.qty + 1 } : l));
    } else {
      setLines((prev) => [...prev, {
        id: generateId(),
        product_id: product.id,
        product_name: product.name,
        qty: 1,
        unit_price: product.unit_price,
        cost_price: product.cost_price ?? 0,
        discount_pct: 0,
        is_custom_order: product.is_custom_order,
      }]);
    }
  }

  function updateLine(id: string, field: keyof OrderLine, value: string | number) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const lineTotal = (l: OrderLine) => l.qty * l.unit_price * (1 - l.discount_pct / 100);
  const orderTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) { setError("Add at least one product."); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId || null,
        channel,
        status: "pending",
        notes: notes || null,
        expected_delivery: expectedDelivery || null,
        delivery_address: deliveryAddress || null,
        created_by: userId,
      })
      .select("id, order_number")
      .single();

    if (orderErr) { setError(orderErr.message); setSaving(false); return; }

    const { error: itemsErr } = await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        qty: l.qty,
        unit_price: l.unit_price,
        cost_price: l.cost_price,
        discount_pct: l.discount_pct,
        is_custom_order: l.is_custom_order,
      }))
    );

    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }

    router.push(`/orders/${order.id}`);
    router.refresh();
  }

  const [productSearch, setProductSearch] = useState("");
  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Customer + Channel */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Customer (optional)</Label>
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customer…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="pl-9 h-8 text-sm" />
            </div>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Walk-in / no customer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Walk-in (no account)</SelectItem>
                {filteredCustomers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company_name ? ` — ${c.company_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as SaleChannel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="walk_in">Walk-in</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="b2b">B2B</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="expected_delivery">Expected Delivery Date</Label>
          <Input id="expected_delivery" type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery_address">Delivery Address</Label>
          <Input id="delivery_address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Where to deliver (optional)" />
        </div>
      </div>

      {/* Product picker */}
      <div className="space-y-2">
        <Label>Add Products</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products to add…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" />
        </div>
        {productSearch && (
          <div className="rounded-lg border bg-card divide-y max-h-48 overflow-y-auto">
            {filteredProducts.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { addLine(p); setProductSearch(""); }}
                className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <span>{p.name}</span>
                <span className="text-muted-foreground ml-4">{formatCurrency(p.unit_price)}</span>
              </button>
            ))}
            {!filteredProducts.length && <p className="px-3 py-2 text-sm text-muted-foreground">No products found.</p>}
          </div>
        )}
      </div>

      {/* Line items */}
      {lines.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Unit</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">Disc%</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Total</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{line.product_name}</td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="1" value={line.qty} onChange={(e) => updateLine(line.id, "qty", parseInt(e.target.value) || 1)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(line.id, "unit_price", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min="0" max="100" value={line.discount_pct} onChange={(e) => updateLine(line.id, "discount_pct", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(lineTotal(line))}</td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => removeLine(line.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30">
                <td colSpan={4} className="px-3 py-2 text-right font-semibold">Order Total</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(orderTotal)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, special requests…" rows={2} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving || !lines.length}>
          {saving ? "Creating…" : "Create Order"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
