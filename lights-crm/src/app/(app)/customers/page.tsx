import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers?.length ?? 0} customers</p>
        </div>
        <Button asChild>
          <Link href="/customers/new">
            <Plus className="h-4 w-4" />
            Add Customer
          </Link>
        </Button>
      </div>

      {!customers?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No customers yet.</p>
            <Button asChild><Link href="/customers/new">Add Customer</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone / WhatsApp</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c: any) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    {c.company_name && <div className="text-xs text-muted-foreground">{c.company_name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.type === "b2b" ? "default" : "secondary"}>
                      {c.type === "b2b" ? "B2B" : "Retail"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.whatsapp ?? c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/customers/${c.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
