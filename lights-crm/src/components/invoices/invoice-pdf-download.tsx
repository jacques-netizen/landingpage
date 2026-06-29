"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { InvoicePdfData } from "./invoice-pdf-inner";

// react-pdf must only run in the browser — load it with SSR disabled.
const InvoicePdfInner = dynamic(() => import("./invoice-pdf-inner"), {
  ssr: false,
  loading: () => (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <Download className="h-4 w-4" />
      Loading…
    </span>
  ),
});

export function InvoicePdfDownload({ data }: { data: InvoicePdfData }) {
  return (
    <Button variant="outline" size="sm" className="print:hidden" asChild>
      <span className="cursor-pointer">
        <InvoicePdfInner data={data} />
      </span>
    </Button>
  );
}
