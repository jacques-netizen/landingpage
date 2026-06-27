import { createClient } from "@/lib/supabase/server";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string }>;
}) {
  const { customer_id } = await searchParams;
  const supabase = await createClient();

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase.from("customers").select("id, name, company_name").order("name"),
    supabase.from("products").select("id, name, unit_price").order("name"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">New Invoice</h1>
        <p className="text-sm text-muted-foreground">Create an invoice or quote for a customer.</p>
      </div>
      <InvoiceBuilder
        customers={customers ?? []}
        products={products ?? []}
        defaultCustomerId={customer_id}
      />
    </div>
  );
}
