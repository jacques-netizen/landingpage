"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { XCircle } from "lucide-react";

interface CancelOrderButtonProps {
  orderId: string;
  orderNumber: string;
  hasInvoice: boolean;
}

export function CancelOrderButton({ orderId, orderNumber, hasInvoice }: CancelOrderButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setProcessing(true);
    setError("");
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("cancel_order", {
      p_order_id: orderId,
      p_reason: reason.trim() || null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setProcessing(false);
      return;
    }
    setOpen(false);
    setProcessing(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" />
        Cancel Order
      </Button>

      <Dialog open={open} onOpenChange={(v) => !processing && setOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel {orderNumber}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This restores any deducted stock to inventory
              {hasInvoice ? " and voids the linked invoice (reversing its payments)" : ""}. This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Input
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. customer changed mind, damaged on delivery"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={processing}>
                Keep order
              </Button>
              <Button
                className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                onClick={handleCancel}
                disabled={processing}
              >
                {processing ? "Cancelling…" : "Cancel order"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
