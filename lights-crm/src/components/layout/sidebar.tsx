"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  ClipboardList,
  BarChart2,
  Settings,
  Truck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserRole } from "@/types";

const overviewItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "sales", "warehouse", "accountant"] },
  { href: "/reports", label: "Reports", icon: BarChart2, roles: ["admin", "accountant"] },
];

const operationsItems = [
  { href: "/pos", label: "Point of Sale", icon: ShoppingCart, roles: ["admin", "sales"] },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "sales", "warehouse"] },
  { href: "/customers", label: "Customers", icon: Users, roles: ["admin", "sales", "accountant"] },
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ["admin", "sales", "warehouse"] },
  { href: "/purchase-orders", label: "Purchasing", icon: Truck, roles: ["admin", "warehouse"] },
  { href: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "sales", "accountant"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

interface SidebarProps {
  userRole: UserRole;
  userName: string;
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      style={active ? { background: "rgba(224,22,34,0.12)", borderLeft: "3px solid #E01622", color: "#ffffff" } : {}}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "pl-[9px]"
          : "text-[#9A9089] hover:bg-white/5 hover:text-white border-l-[3px] border-l-transparent"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" style={active ? { color: "#E01622" } : {}} />
      {label}
    </Link>
  );
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const visibleOverview = overviewItems.filter((item) => item.roles.includes(userRole));
  const visibleOperations = operationsItems.filter((item) => item.roles.includes(userRole));

  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <aside
      className="flex h-screen w-60 flex-col shrink-0"
      style={{ background: "#0F0C0B" }}
    >
      {/* Top red gradient accent line */}
      <div style={{ height: "3px", background: "linear-gradient(90deg,#E01622,#9C0A13)" }} />

      {/* Logo + brand */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* 3D glossy ball */}
        <svg viewBox="0 0 40 40" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <defs>
            <radialGradient id="ball" cx="38%" cy="32%" r="62%">
              <stop offset="0%" stopColor="#FF4D55" />
              <stop offset="45%" stopColor="#E01622" />
              <stop offset="100%" stopColor="#6B0009" />
            </radialGradient>
            <radialGradient id="gloss" cx="35%" cy="28%" r="45%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="20" cy="20" r="20" fill="url(#ball)" />
          <circle cx="20" cy="20" r="20" fill="url(#gloss)" />
          <circle cx="20" cy="20" r="12" fill="white" />
          <text
            x="20" y="25"
            textAnchor="middle"
            fill="#1B1714"
            fontSize="10"
            fontWeight="700"
            fontFamily="var(--font-oswald), Arial, sans-serif"
            letterSpacing="0.5"
          >
            17
          </text>
        </svg>

        <div className="leading-tight">
          <div
            className="font-semibold text-white"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: "19px", letterSpacing: "0.01em" }}
          >
            17 Prime Home
          </div>
          <div
            className="uppercase tracking-widest"
            style={{ fontFamily: "var(--font-oswald), Arial, sans-serif", fontSize: "8px", color: "#E01622", letterSpacing: "0.18em" }}
          >
            Accra · Ghana
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-4">
        {/* Overview section */}
        {visibleOverview.length > 0 && (
          <div>
            <div
              className="px-3 mb-1 uppercase tracking-widest"
              style={{ fontFamily: "var(--font-oswald), Arial, sans-serif", fontSize: "8px", color: "#4a3f3a", letterSpacing: "0.2em" }}
            >
              Overview
            </div>
            <div className="space-y-0.5">
              {visibleOverview.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Operations section */}
        {visibleOperations.length > 0 && (
          <div>
            <div
              className="px-3 mb-1 uppercase tracking-widest"
              style={{ fontFamily: "var(--font-oswald), Arial, sans-serif", fontSize: "8px", color: "#4a3f3a", letterSpacing: "0.2em" }}
            >
              Operations
            </div>
            <div className="space-y-0.5">
              {visibleOperations.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User card */}
      <div className="p-3">
        <div
          className="rounded-lg p-3 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg,#E01622,#9C0A13)", fontFamily: "var(--font-oswald), Arial, sans-serif" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-medium truncate leading-tight">{userName}</div>
            <div
              className="uppercase truncate"
              style={{ fontFamily: "var(--font-oswald), Arial, sans-serif", fontSize: "9px", color: "#E01622", letterSpacing: "0.15em" }}
            >
              {userRole}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-[#4a3f3a] hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
