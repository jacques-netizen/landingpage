"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { OrderStatus } from "@/types";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "confirmed", label: "Confirmed" },
  { status: "in_progress", label: "In Progress" },
  { status: "ready", label: "Ready" },
  { status: "delivered", label: "Delivered" },
];

interface OrderStatusStepperProps {
  orderId: string;
  currentStatus: OrderStatus;
}

export function OrderStatusStepper({ orderId, currentStatus }: OrderStatusStepperProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const currentIndex = STEPS.findIndex((s) => s.status === currentStatus);

  async function updateStatus(status: OrderStatus) {
    if (status === currentStatus || currentStatus === "cancelled") return;
    setUpdating(true);
    const supabase = createClient();
    await supabase.from("orders").update({ status }).eq("id", orderId);
    router.refresh();
    setUpdating(false);
  }

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const reachable = index <= currentIndex + 1 && currentStatus !== "cancelled";

        return (
          <div key={step.status} className="flex items-center">
            <button
              onClick={() => reachable && updateStatus(step.status)}
              disabled={updating || !reachable || active}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors text-xs font-medium",
                done && "cursor-pointer hover:bg-green-50",
                active && "cursor-default",
                reachable && !active && !done && "cursor-pointer hover:bg-accent",
                !reachable && "cursor-default opacity-40"
              )}
            >
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-colors",
                done ? "bg-green-500 border-green-500 text-white" : "",
                active ? "border-primary bg-primary text-primary-foreground" : "",
                !done && !active ? "border-muted-foreground/30 text-muted-foreground" : ""
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs">{index + 1}</span>}
              </div>
              <span className={cn(
                "whitespace-nowrap",
                active ? "text-primary" : done ? "text-green-600" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={cn("h-0.5 w-8 mx-1 transition-colors", done ? "bg-green-400" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
