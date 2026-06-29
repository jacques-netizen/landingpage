"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export function ConvertQuoteButton({ quoteId, quoteNumber }: { quoteId: string; quoteNumber: string }) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleConvert() {
    setProcessing(true);
    setError("");
    const supabase = createClient();
    const { data, error: rpcErr } = await supabase.rpc("convert_quote_to_invoice", { p_quote_id: quoteId });
    if (rpcErr) { setError(rpcErr.message); setProcessing(false); return; }
    router.push(`/invoices/${data}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleConvert} disabled={processing}>
        <FileText className="h-4 w-4" />
        {processing ? "Converting…" : "Convert to invoice"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
