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
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserRole } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "sales", "warehouse", "accountant"] },
  { href: "/pos", label: "Point of Sale", icon: ShoppingCart, roles: ["admin", "sales"] },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "sales", "warehouse"] },
  { href: "/customers", label: "Customers", icon: Users, roles: ["admin", "sales", "accountant"] },
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ["admin", "sales", "warehouse"] },
  { href: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "sales", "accountant"] },
  { href: "/reports", label: "Reports", icon: BarChart2, roles: ["admin", "accountant"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

interface SidebarProps {
  userRole: UserRole;
  userName: string;
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <svg viewBox="0 0 36 36" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <circle cx="18" cy="18" r="18" fill="#DC2626"/>
          <circle cx="18" cy="18" r="11" fill="white"/>
          <text x="18" y="23" textAnchor="middle" fill="#0c0c0c" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif">17</text>
        </svg>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide text-foreground">17 Prime Home</div>
          <div className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">Management</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 px-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground truncate">{userName}</div>
          <div className="capitalize">{userRole}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
