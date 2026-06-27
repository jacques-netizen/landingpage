import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Add Customer</h1>
        <p className="text-sm text-muted-foreground">Add a new customer to your CRM.</p>
      </div>
      <CustomerForm />
    </div>
  );
}
