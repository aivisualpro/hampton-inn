"use client";

import { usePathname } from "next/navigation";
import {
  Shield,
  Users,
  Package,
  Settings,
  MapPin,
  ClipboardList,
  ShoppingCart,
  Droplets,
  Hotel,
  FileText,
  BarChart3,
  AlertTriangle,
  LucideIcon,
  Home,
} from "lucide-react";

type RouteConfig = {
  title: string;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
};

const ROUTE_MAP: Record<string, RouteConfig> = {
  "/": {
    title: "Dashboard",
    icon: Home,
    gradient: "from-blue-600 to-indigo-600",
    iconColor: "text-blue-500",
  },
  "/admin": {
    title: "Administration",
    icon: Shield,
    gradient: "from-rose-600 to-pink-600",
    iconColor: "text-rose-500",
  },
  "/admin/users": {
    title: "Users",
    icon: Users,
    gradient: "from-violet-600 to-purple-600",
    iconColor: "text-violet-500",
  },
  "/admin/items": {
    title: "Items",
    icon: Package,
    gradient: "from-amber-600 to-orange-600",
    iconColor: "text-amber-500",
  },
  "/admin/settings": {
    title: "Settings",
    icon: Settings,
    gradient: "from-slate-600 to-gray-600",
    iconColor: "text-slate-500",
  },
  "/admin/locations": {
    title: "Locations",
    icon: MapPin,
    gradient: "from-emerald-600 to-teal-600",
    iconColor: "text-emerald-500",
  },
  "/admin/transactions": {
    title: "Transactions",
    icon: FileText,
    gradient: "from-cyan-600 to-blue-600",
    iconColor: "text-cyan-500",
  },
  "/admin/reports": {
    title: "Reports",
    icon: BarChart3,
    gradient: "from-indigo-600 to-blue-600",
    iconColor: "text-indigo-500",
  },
  "/admin/reports/closing-stock": {
    title: "Closing Stock",
    icon: ClipboardList,
    gradient: "from-green-600 to-emerald-600",
    iconColor: "text-green-500",
  },
  "/admin/reports/par-level": {
    title: "Par Level",
    icon: BarChart3,
    gradient: "from-sky-600 to-blue-600",
    iconColor: "text-sky-500",
  },
  "/admin/reports/restock-alerts": {
    title: "Restock Alerts",
    icon: AlertTriangle,
    gradient: "from-red-600 to-rose-600",
    iconColor: "text-red-500",
  },
  "/stock-count": {
    title: "Stock Count",
    icon: ClipboardList,
    gradient: "from-blue-600 to-indigo-600",
    iconColor: "text-blue-500",
  },
  "/stock-purchase": {
    title: "Stock Purchase",
    icon: ShoppingCart,
    gradient: "from-emerald-600 to-green-600",
    iconColor: "text-emerald-500",
  },
  "/soak-cycle": {
    title: "Soak Cycle",
    icon: Droplets,
    gradient: "from-cyan-600 to-teal-600",
    iconColor: "text-cyan-500",
  },
  "/breakfast-consumption": {
    title: "Breakfast",
    icon: Hotel,
    gradient: "from-purple-600 to-violet-600",
    iconColor: "text-purple-500",
  },
};

function getRouteConfig(pathname: string): RouteConfig | null {
  // Exact match first
  if (ROUTE_MAP[pathname]) return ROUTE_MAP[pathname];

  // Try parent paths (e.g., /admin/items/[id] -> /admin/items)
  const segments = pathname.split("/").filter(Boolean);
  while (segments.length > 0) {
    const tryPath = "/" + segments.join("/");
    if (ROUTE_MAP[tryPath]) return ROUTE_MAP[tryPath];
    segments.pop();
  }

  return null;
}

export function PageTitle() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/login") return null;

  const config = getRouteConfig(pathname);
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2.5 animate-in fade-in slide-in-from-left-3 duration-300">
      <div
        className={`flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br ${config.gradient} shadow-sm`}
      >
        <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </div>
      <span
        className="text-sm font-semibold tracking-tight text-gray-800"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {config.title}
      </span>
    </div>
  );
}
