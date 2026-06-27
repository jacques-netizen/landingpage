import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Package, Users, AlertTriangle, FileText } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { data: todaySales },
    { data: monthSales },
    { data: lowStock },
    { data: overdueInvoices },
    { data: customerCount },
  ] = await Promise.all([
    supabase.rpc("get_sales_total", { from_date: today, to_date: today }),
    supabase.rpc("get_sales_total", { from_date: monthStart.split("T")[0], to_date: today }),
    supabase.from("products").select("id, name, stock_qty, low_stock_threshold").filter("stock_qty", "lte", "low_stock_threshold"),
    supabase.from("invoices").select("id, invoice_number, total, amount_paid, customers(name)").eq("status", "overdue"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    {
      label: "Today's Sales",
      value: formatCurrency(todaySales ?? 0),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "This Month",
      value: formatCurrency(monthSales ?? 0),
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Customers",
      value: String(customerCount ?? 0),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Low Stock Items",
      value: String(lowStock?.length ?? 0),
      icon: Package,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-BE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!lowStock?.length ? (
              <p className="text-sm text-muted-foreground">All items are well stocked.</p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.name}</span>
                    <Badge variant={p.stock_qty === 0 ? "destructive" : "warning"}>
                      {p.stock_qty} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-red-500" />
              Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!overdueInvoices?.length ? (
              <p className="text-sm text-muted-foreground">No overdue invoices.</p>
            ) : (
              <div className="space-y-2">
                {overdueInvoices.slice(0, 6).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{inv.invoice_number}</span>
                      <span className="ml-2 text-muted-foreground">{inv.customers?.name}</span>
                    </div>
                    <Badge variant="destructive">
                      {formatCurrency(inv.total - inv.amount_paid)} due
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
