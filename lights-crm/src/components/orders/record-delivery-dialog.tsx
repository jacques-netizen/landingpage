"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Truck } from "lucide-react";

interface RecordDeliveryDialogProps {
  orderId: string;
  orderNumber: string;
  alreadyDelivered: boolean;
}

export function RecordDeliveryDialog({ orderId, orderNumber, alreadyDelivered }: RecordDeliveryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receivedBy.trim()) { setError("Enter who received the delivery."); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        delivered_at: new Date(deliveredAt).toISOString(),
        received_by: receivedBy.trim(),
        delivery_note: note.trim() || null,
      })
      .eq("id", orderId);

    if (updErr) { setError(updErr.message); setSaving(false); return; }

    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={alreadyDelivered ? "outline" : "default"} size="sm">
          <Truck className="h-4 w-4" />
          {alreadyDelivered ? "Edit delivery" : "Record delivery"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record delivery — {orderNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dl-by">Received by *</Label>
              <Input id="dl-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name of person who took delivery" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dl-date">Delivered on</Label>
              <Input id="dl-date" type="date" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dl-note">Note / proof</Label>
            <Textarea id="dl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. left with security, signed waybill #123, condition on arrival…" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Mark delivered"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
