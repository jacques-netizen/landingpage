"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Category, Supplier } from "@/types";

interface ProductFormProps {
  categories: Category[];
  suppliers: Supplier[];
  product?: {
    id: string;
    sku: string;
    name: string;
    description?: string;
    category_id?: string;
    supplier_id?: string;
    brand?: string;
    unit_price: number;
    cost_price?: number;
    stock_qty: number;
    low_stock_threshold: number;
    is_custom_order: boolean;
  };
}

function generateSKU() {
  return "SKU-" + Math.random().toString(36).toUpperCase().slice(2, 8);
}

export function ProductForm({ categories, suppliers, product }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!product;

  const [form, setForm] = useState({
    sku: product?.sku ?? generateSKU(),
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? "",
    supplier_id: product?.supplier_id ?? "",
    brand: product?.brand ?? "",
    unit_price: product?.unit_price?.toString() ?? "",
    cost_price: product?.cost_price?.toString() ?? "",
    stock_qty: product?.stock_qty?.toString() ?? "0",
    low_stock_threshold: product?.low_stock_threshold?.toString() ?? "5",
    is_custom_order: product?.is_custom_order ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const marginHint = (() => {
    const price = parseFloat(form.unit_price);
    const cost = parseFloat(form.cost_price);
    if (!price || !cost || cost <= 0) return null;
    const profit = price - cost;
    const pct = (profit / price) * 100;
    return {
      negative: profit < 0,
      text: `Margin: GH₵ ${profit.toFixed(2)} (${pct.toFixed(1)}%)`,
    };
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || null,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      brand: form.brand || null,
      unit_price: parseFloat(form.unit_price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      stock_qty: parseInt(form.stock_qty) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
      is_custom_order: form.is_custom_order,
    };

    const { error: err } = isEditing
      ? await supabase.from("products").update(payload).eq("id", product!.id)
      : await supabase.from("products").insert(payload);

    if (err) {
      setError(err.message);
      setSaving(false);
    } else {
      router.push("/inventory");
      router.refresh();
    }
  }

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Product Name *</Label>
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="e.g. Crystal Chandelier 6-arm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU *</Label>
          <Input id="sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} required placeholder="SKU-XXXXXX" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Eglo, Ideal Lux" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cost_price">Landed Cost (GH₵)</Label>
          <Input id="cost_price" type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} placeholder="0.00" />
          <p className="text-xs text-muted-foreground">True per-unit cost: supplier + freight + Tema duty/VAT/levies.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit_price">Selling Price (GH₵) *</Label>
          <Input id="unit_price" type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} required placeholder="0.00" />
          {marginHint && <p className={`text-xs ${marginHint.negative ? "text-destructive" : "text-muted-foreground"}`}>{marginHint.text}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="stock_qty">Stock Qty</Label>
          <Input id="stock_qty" type="number" min="0" value={form.stock_qty} onChange={(e) => set("stock_qty", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="low_stock_threshold">Low Stock Alert At</Label>
          <Input id="low_stock_threshold" type="number" min="0" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Supplier</Label>
        <Select value={form.supplier_id} onValueChange={(v) => set("supplier_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional product description, dimensions, specs…" rows={3} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-4">
        <Switch
          id="custom_order"
          checked={form.is_custom_order}
          onCheckedChange={(v) => set("is_custom_order", v)}
        />
        <div>
          <Label htmlFor="custom_order" className="cursor-pointer">Custom / Special Order Item</Label>
          <p className="text-xs text-muted-foreground mt-0.5">This item is sourced per request, not kept in stock.</p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Product"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
