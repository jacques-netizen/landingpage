import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/components/customers/customer-form";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!customer) notFound();

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Edit Customer</h1>
        <p className="text-sm text-muted-foreground">{customer.name}</p>
      </div>
      <CustomerForm customer={customer} />
    </div>
  );
}
