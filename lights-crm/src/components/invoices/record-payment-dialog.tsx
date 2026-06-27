"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { PaymentMethod } from "@/types";
import { CreditCard } from "lucide-react";

interface RecordPaymentDialogProps {
  invoiceId: string;
  outstanding: number;
  userId: string;
}

export function RecordPaymentDialog({ invoiceId, outstanding, userId }: RecordPaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.from("payments").insert({
      invoice_id: invoiceId,
      amount: parseFloat(amount),
      method,
      reference: reference || null,
      recorded_by: userId,
    });

    if (err) { setError(err.message); setSaving(false); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CreditCard className="h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Outstanding: </span>
            <span className="font-semibold">{formatCurrency(outstanding)}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (€) *</Label>
            <Input id="amount" type="number" min="0.01" step="0.01" max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer ref, transaction ID…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm Payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
