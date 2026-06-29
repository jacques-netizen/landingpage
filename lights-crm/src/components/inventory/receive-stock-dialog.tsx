"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PackagePlus } from "lucide-react";

interface ReceiveStockDialogProps {
  productId: string;
  productName: string;
  currentStock: number;
  currentCost: number;
}

export function ReceiveStockDialog({ productId, productName, currentStock, currentCost }: ReceiveStockDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [landedCost, setLandedCost] = useState(currentCost ? String(currentCost) : "");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qtyNum = parseInt(qty) || 0;
  const newStock = currentStock + qtyNum;
  const costNum = parseFloat(landedCost);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qtyNum <= 0) { setError("Enter the quantity received."); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: adjErr } = await supabase.from("stock_adjustments").insert({
      product_id: productId,
      qty_change: qtyNum,
      reason: `Goods received${reference.trim() ? `: ${reference.trim()}` : ""}`,
      adjusted_by: user!.id,
    });
    if (adjErr) { setError(adjErr.message); setSaving(false); return; }

    const update: { stock_qty: number; cost_price?: number } = { stock_qty: newStock };
    if (landedCost !== "" && !Number.isNaN(costNum)) update.cost_price = costNum;

    const { error: prodErr } = await supabase.from("products").update(update).eq("id", productId);
    if (prodErr) { setError(prodErr.message); setSaving(false); return; }

    setOpen(false);
    setQty("");
    setReference("");
    setSaving(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PackagePlus className="h-4 w-4" />
          Receive Stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Stock — {productName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">In stock:</span>
            <span className="font-semibold">{currentStock}</span>
            {qtyNum > 0 && (
              <>
                <span className="text-muted-foreground">→ After:</span>
                <span className="font-semibold text-green-600">{newStock}</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recv-qty">Quantity received *</Label>
              <Input id="recv-qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 50" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recv-cost">Landed cost / unit (GH₵)</Label>
              <Input id="recv-cost" type="number" min="0" step="0.01" value={landedCost} onChange={(e) => setLandedCost(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Landed cost = supplier price + freight + Tema duty/VAT/levies, per unit. Updating it here updates the product&apos;s cost.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="recv-ref">Reference / note</Label>
            <Input id="recv-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Container KVI-Apr, PI #1234" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || qtyNum <= 0}>
              {saving ? "Saving…" : "Receive into stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
