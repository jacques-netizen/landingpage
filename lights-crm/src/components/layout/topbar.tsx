"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "Point of Sale",
  "/inventory": "Inventory",
  "/customers": "Customers",
  "/orders": "Orders",
  "/invoices": "Invoices",
  "/reports": "Reports",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(pageTitles)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (pathname !== prefix) {
        if (pathname.endsWith("/new")) return `New ${title.replace(/s$/, "")}`;
        return title.replace(/s$/, "") + " Detail";
      }
      return title;
    }
  }
  return "17 Prime Home";
}

export function Topbar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header
      className="flex h-16 items-center justify-between px-6 shrink-0"
      style={{ background: "#ffffff", borderBottom: "1px solid #EAE3D6" }}
    >
      <h1
        style={{
          fontFamily: "var(--font-cormorant), Georgia, serif",
          fontSize: "30px",
          fontWeight: 700,
          color: "#1B1714",
          lineHeight: 1,
        }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: "#8A8076" }}
          />
          <input
            type="text"
            placeholder="Search…"
            className="pl-9 pr-4 py-2 text-sm outline-none rounded-full w-48"
            style={{
              background: "#F5F0E8",
              border: "none",
              color: "#1B1714",
              fontFamily: "var(--font-manrope), Arial, sans-serif",
            }}
          />
        </div>

        {/* Bell */}
        <button className="relative p-2 rounded-full hover:bg-[#F5F0E8] transition-colors">
          <Bell className="h-5 w-5" style={{ color: "#8A8076" }} />
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
            style={{ background: "#E01622" }}
          />
        </button>

        {/* New Sale */}
        <Link
          href="/pos"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(100deg,#E01622,#9C0A13)",
            boxShadow: "0 2px 12px rgba(224,22,34,0.35)",
            fontFamily: "var(--font-manrope), Arial, sans-serif",
          }}
        >
          New Sale
        </Link>
      </div>
    </header>
  );
}
