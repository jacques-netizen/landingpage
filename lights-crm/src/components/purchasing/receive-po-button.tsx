"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PackageCheck } from "lucide-react";

export function ReceivePOButton({ poId, poNumber }: { poId: string; poNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleReceive() {
    setProcessing(true);
    setError("");
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("receive_purchase_order", { p_po_id: poId });
    if (rpcErr) { setError(rpcErr.message); setProcessing(false); return; }
    setOpen(false);
    setProcessing(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PackageCheck className="h-4 w-4" />
        Receive into stock
      </Button>
      <Dialog open={open} onOpenChange={(v) => !processing && setOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receive {poNumber}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This adds every line to <span className="font-medium">warehouse</span> stock and updates each product&apos;s
            landed cost to the PO unit cost. The PO is marked received.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>Cancel</Button>
            <Button onClick={handleReceive} disabled={processing}>{processing ? "Receiving…" : "Receive"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
