"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowUpDown } from "lucide-react";

interface StockAdjustDialogProps {
  productId: string;
  productName: string;
  currentStock: number;
}

export function StockAdjustDialog({ productId, productName, currentStock }: StockAdjustDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qtyNum = parseInt(qty) || 0;
  const newStock = currentStock + qtyNum;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qty || !reason.trim()) return;
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: adjErr } = await supabase.from("stock_adjustments").insert({
      product_id: productId,
      qty_change: qtyNum,
      reason: reason.trim(),
      adjusted_by: user!.id,
    });

    if (adjErr) {
      setError(adjErr.message);
      setSaving(false);
      return;
    }

    const { error: prodErr } = await supabase
      .from("products")
      .update({ stock_qty: newStock })
      .eq("id", productId);

    if (prodErr) {
      setError(prodErr.message);
      setSaving(false);
      return;
    }

    setOpen(false);
    setQty("");
    setReason("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowUpDown className="h-4 w-4" />
          Adjust Stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock — {productName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Current stock:</span>
            <span className="font-semibold">{currentStock}</span>
            {qty && (
              <>
                <span className="text-muted-foreground">→ New stock:</span>
                <span className={`font-semibold ${newStock < 0 ? "text-destructive" : "text-green-600"}`}>{newStock}</span>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity Change</Label>
            <Input
              id="qty"
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="+10 for restock, -3 for damage/use"
              required
            />
            <p className="text-xs text-muted-foreground">Use positive numbers to add stock, negative to remove.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received shipment from supplier, Damaged in transit, Sold off-system…"
              rows={2}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !qty || !reason.trim() || newStock < 0}>
              {saving ? "Saving…" : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
