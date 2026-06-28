"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ChannelData {
  channel: string;
  count: number;
  revenue: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  walk_in: "#f59e0b",
  phone: "#3b82f6",
  whatsapp: "#22c55e",
  b2b: "#8b5cf6",
};

const CHANNEL_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  b2b: "B2B",
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow text-sm">
      <p className="font-medium">{CHANNEL_LABELS[d.channel] ?? d.channel}</p>
      <p className="text-muted-foreground">{d.count} orders</p>
      <p className="font-semibold">{formatCurrency(d.revenue)}</p>
    </div>
  );
}

export function ChannelChart({ data }: { data: ChannelData[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data for this period.
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, name: CHANNEL_LABELS[d.channel] ?? d.channel }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="revenue"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={40}
        >
          {chartData.map((entry) => (
            <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
