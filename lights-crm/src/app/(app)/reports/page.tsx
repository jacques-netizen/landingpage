import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalesChart } from "@/components/reports/sales-chart";
import { ChannelChart } from "@/components/reports/channel-chart";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, Package, Users, AlertCircle } from "lucide-react";

type Period = "week" | "month" | "3months" | "year";

function getPeriodRange(period: Period): { from: Date; to: Date; groupBy: "day" | "month" } {
  const now = new Date();
  const to = new Date(now);
  let from: Date;
  let groupBy: "day" | "month" = "day";

  switch (period) {
    case "week":
      from = new Date(now);
      from.setDate(now.getDate() - 6);
      break;
    case "month":
      from = new Date(now);
      from.setDate(now.getDate() - 29);
      break;
    case "3months":
      from = new Date(now);
      from.setMonth(now.getMonth() - 3);
      groupBy = "month";
      break;
    case "year":
      from = new Date(now);
      from.setFullYear(now.getFullYear() - 1);
      groupBy = "month";
      break;
  }

  return { from, to, groupBy };
}

function buildDailyBuckets(from: Date, to: Date, rows: { date: string; revenue: number }[]) {
  const map = new Map(rows.map((r) => [r.date, r.revenue]));
  const result = [];
  const cur = new Date(from);
  while (cur <= to) {
    const key = cur.toISOString().split("T")[0];
    const label = cur.toLocaleDateString("en-GH", { month: "short", day: "numeric" });
    result.push({ label, revenue: map.get(key) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function buildMonthlyBuckets(from: Date, to: Date, rows: { month: string; revenue: number }[]) {
  const map = new Map(rows.map((r) => [r.month, r.revenue]));
  const result = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cur <= to) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const label = cur.toLocaleDateString("en-GH", { month: "short", year: "2-digit" });
    result.push({ label, revenue: map.get(key) ?? 0 });
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "This week",
  month: "Last 30 days",
  "3months": "Last 3 months",
  year: "Last 12 months",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = (["week", "month", "3months", "year"].includes(rawPeriod ?? "")
    ? rawPeriod
    : "month") as Period;

  const { from, to, groupBy } = getPeriodRange(period);
  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  const supabase = await createClient();

  const [
    { data: revenueRows },
    { data: channelRows },
    { data: bestSellers },
    { data: topCustomers },
    { data: overdueInvoices },
    { data: totalPaid },
  ] = await Promise.all([
    // Revenue grouped by day or month
    groupBy === "day"
      ? supabase.rpc("get_daily_revenue", { from_ts: fromStr, to_ts: toStr })
      : supabase.rpc("get_monthly_revenue", { from_ts: fromStr, to_ts: toStr }),

    // Sales by channel
    supabase
      .from("orders")
      .select("channel")
      .gte("created_at", fromStr)
      .lte("created_at", toStr)
      .neq("status", "cancelled"),

    // Best-selling products: get order_items via orders in date range
    supabase
      .from("order_items")
      .select("qty, unit_price, discount_pct, products(id, name), orders!inner(created_at)")
      .gte("orders.created_at" as any, fromStr)
      .lte("orders.created_at" as any, toStr),

    // Top customers by invoiced amount
    supabase
      .from("invoices")
      .select("total, amount_paid, customers(id, name, type)")
      .gte("created_at", fromStr)
      .lte("created_at", toStr)
      .in("status", ["paid", "partially_paid", "sent", "overdue"]),

    // Overdue invoices
    supabase
      .from("invoices")
      .select("id, invoice_number, total, amount_paid, customers(name)")
      .eq("status", "overdue"),

    // Total paid in period
    supabase
      .from("invoices")
      .select("amount_paid")
      .gte("created_at", fromStr)
      .lte("created_at", toStr)
      .in("status", ["paid", "partially_paid"]),
  ]);

  // Margin by channel: order items with cost snapshot, joined to orders.
  // Builder typed as any — the joined-column filters exceed the typed builder's inference depth.
  const marginQuery: any = supabase
    .from("order_items")
    .select("qty, unit_price, discount_pct, cost_price, orders!inner(channel, status, created_at)");
  const { data: marginRows } = (await marginQuery
    .gte("orders.created_at", fromStr)
    .lte("orders.created_at", toStr)
    .neq("orders.status", "cancelled")) as { data: any[] | null };

  // Build chart data
  const revenueData = groupBy === "day"
    ? buildDailyBuckets(from, to, (revenueRows ?? []) as any)
    : buildMonthlyBuckets(from, to, (revenueRows ?? []) as any);

  // Channel aggregation (client-side since Supabase doesn't support GROUP BY without RPC)
  const channelMap = new Map<string, { count: number; revenue: number }>();
  for (const row of (channelRows ?? [])) {
    const ch = (row as any).channel as string;
    const existing = channelMap.get(ch) ?? { count: 0, revenue: 0 };
    channelMap.set(ch, { count: existing.count + 1, revenue: existing.revenue });
  }
  const channelData = Array.from(channelMap.entries()).map(([channel, v]) => ({ channel, ...v }));

  // Best sellers aggregation
  const productMap = new Map<string, { name: string; units: number; revenue: number }>();
  for (const item of (bestSellers ?? [])) {
    const p = (item as any).products;
    if (!p) continue;
    const rev = item.qty * item.unit_price * (1 - item.discount_pct / 100);
    const existing = productMap.get(p.id) ?? { name: p.name, units: 0, revenue: 0 };
    productMap.set(p.id, { name: p.name, units: existing.units + item.qty, revenue: existing.revenue + rev });
  }
  const bestSellersList = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Top customers aggregation
  const customerMap = new Map<string, { name: string; type: string; invoiceCount: number; totalPaid: number }>();
  for (const inv of (topCustomers ?? [])) {
    const c = (inv as any).customers;
    if (!c) continue;
    const existing = customerMap.get(c.id) ?? { name: c.name, type: c.type, invoiceCount: 0, totalPaid: 0 };
    customerMap.set(c.id, {
      name: c.name,
      type: c.type,
      invoiceCount: existing.invoiceCount + 1,
      totalPaid: existing.totalPaid + (inv.amount_paid ?? 0),
    });
  }
  const topCustomersList = Array.from(customerMap.values()).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 10);

  const periodRevenue = (totalPaid ?? []).reduce((s: number, inv: any) => s + (inv.amount_paid ?? 0), 0);
  const overdueTotal = (overdueInvoices ?? []).reduce((s: number, inv: any) => s + Math.max(0, inv.total - inv.amount_paid), 0);

  // Margin by channel (revenue − cost of goods sold, using the cost snapshot)
  const channelLabels: Record<string, string> = {
    walk_in: "Walk-in", phone: "Phone", whatsapp: "WhatsApp", b2b: "B2B",
  };
  const marginMap = new Map<string, { revenue: number; cost: number }>();
  for (const row of (marginRows ?? [])) {
    const r = row as any;
    const ch = r.orders?.channel as string;
    if (!ch) continue;
    const revenue = r.qty * r.unit_price * (1 - r.discount_pct / 100);
    const cost = r.qty * (r.cost_price ?? 0);
    const existing = marginMap.get(ch) ?? { revenue: 0, cost: 0 };
    marginMap.set(ch, { revenue: existing.revenue + revenue, cost: existing.cost + cost });
  }
  const marginByChannel = Array.from(marginMap.entries())
    .map(([channel, v]) => ({
      channel: channelLabels[channel] ?? channel,
      revenue: v.revenue,
      cost: v.cost,
      profit: v.revenue - v.cost,
      marginPct: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
  const grossRevenue = marginByChannel.reduce((s, m) => s + m.revenue, 0);
  const grossCost = marginByChannel.reduce((s, m) => s + m.cost, 0);
  const grossProfit = grossRevenue - grossCost;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  const periods: Period[] = ["week", "month", "3months", "year"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex gap-1 rounded-lg border p-1 bg-card">
          {periods.map((p) => (
            <Link
              key={p}
              href={`/reports?period=${p}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(periodRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABELS[period]}</p>
              </div>
              <div className="rounded-lg p-2 bg-amber-50">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="mt-1 text-2xl font-semibold">{channelRows?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABELS[period]}</p>
              </div>
              <div className="rounded-lg p-2 bg-blue-50">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Customers billed</p>
                <p className="mt-1 text-2xl font-semibold">{customerMap.size}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABELS[period]}</p>
              </div>
              <div className="rounded-lg p-2 bg-purple-50">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(overdueTotal)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{overdueInvoices?.length ?? 0} invoices</p>
              </div>
              <div className="rounded-lg p-2 bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart data={revenueData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ChannelChart data={channelData} />
          </CardContent>
        </Card>
      </div>

      {/* Gross margin by channel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Gross Margin by Channel</CardTitle>
            <div className="text-right">
              <span className="text-sm text-muted-foreground mr-2">Total gross profit</span>
              <span className="text-lg font-semibold">{formatCurrency(grossProfit)}</span>
              <span className="text-sm text-muted-foreground ml-2">({grossMarginPct.toFixed(1)}%)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!marginByChannel.length ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">
              No sales in this period. Margin appears once products have a landed cost and are sold.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Channel</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Revenue</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Cost</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Profit</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Margin</th>
                </tr>
              </thead>
              <tbody>
                {marginByChannel.map((m, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{m.channel}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(m.revenue)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(m.cost)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(m.profit)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${m.profit < 0 ? "text-destructive" : "text-green-600"}`}>
                      {m.marginPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Best-Selling Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!bestSellersList.length ? (
              <p className="text-sm text-muted-foreground px-6 pb-4">No sales in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Product</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Units</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSellersList.map((p, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium truncate max-w-[160px]">{p.name}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{p.units}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!topCustomersList.length ? (
              <p className="text-sm text-muted-foreground px-6 pb-4">No invoiced customers in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Customer</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Invoices</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomersList.map((c, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium truncate max-w-[140px]">{c.name}</div>
                        <Badge variant={c.type === "b2b" ? "default" : "secondary"} className="text-xs mt-0.5">{c.type}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{c.invoiceCount}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(c.totalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue details */}
      {!!overdueInvoices?.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-red-600">
              <AlertCircle className="h-4 w-4" />
              Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Invoice</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Outstanding</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-2">{inv.customers?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">
                      {formatCurrency(inv.total - inv.amount_paid)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/invoices/${inv.id}`} className="text-xs text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
