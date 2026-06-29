"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeftRight } from "lucide-react";

interface TransferStockDialogProps {
  productId: string;
  productName: string;
  showroomQty: number;
  warehouseQty: number;
}

type Direction = "to_showroom" | "to_warehouse";

export function TransferStockDialog({ productId, productName, showroomQty, warehouseQty }: TransferStockDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("to_showroom");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qtyNum = parseInt(qty) || 0;
  const source = direction === "to_showroom" ? warehouseQty : showroomQty;
  const overflow = qtyNum > source;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qtyNum <= 0) { setError("Enter a quantity."); return; }
    if (overflow) { setError("Not enough stock at the source location."); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const newShowroom = direction === "to_showroom" ? showroomQty + qtyNum : showroomQty - qtyNum;
    const newWarehouse = direction === "to_showroom" ? warehouseQty - qtyNum : warehouseQty + qtyNum;

    const { error: prodErr } = await supabase
      .from("products")
      .update({ stock_qty: newShowroom, warehouse_qty: newWarehouse })
      .eq("id", productId);
    if (prodErr) { setError(prodErr.message); setSaving(false); return; }

    // On-hand total is unchanged, but log the move for the audit trail.
    await supabase.from("stock_adjustments").insert({
      product_id: productId,
      qty_change: 0,
      reason: `Transfer ${qtyNum} ${direction === "to_showroom" ? "warehouse → showroom" : "showroom → warehouse"}`,
      adjusted_by: user!.id,
    });

    setOpen(false);
    setQty("");
    setSaving(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowLeftRight className="h-4 w-4" />
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Stock — {productName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Showroom:</span>
            <span className="font-semibold">{showroomQty}</span>
            <span className="text-muted-foreground">Warehouse:</span>
            <span className="font-semibold">{warehouseQty}</span>
          </div>

          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="to_showroom">Warehouse → Showroom</SelectItem>
                <SelectItem value="to_warehouse">Showroom → Warehouse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tr-qty">Quantity</Label>
            <Input id="tr-qty" type="number" min="1" max={source} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" required />
            <p className="text-xs text-muted-foreground">Available at source: {source}</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || qtyNum <= 0 || overflow}>
              {saving ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
