
"use client";

import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  admin: "Administration",
  users: "Users",
  items: "Items",
  settings: "Settings",
  locations: "Locations",
  "stock-count": "Stock Count",
  "stock-purchase": "Stock Purchase",
};

export function PageTitle() {
  const pathname = usePathname();
  
  // Don't show on home page
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  // Check for MongoDB ObjectId (24 hex chars)
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(lastSegment);

  if (isObjectId) {
    return null; // Or return generic "Details" if preferred, but user asked to remove ID.
  }

  // Hide title for par-level report as requested
  // Hide title for par-level report as requested
  if (
    lastSegment === "par-level" || 
    lastSegment === "stock-purchase" ||
    lastSegment === "stock-count" ||
    lastSegment === "soak-cycle" ||
    lastSegment === "daily-occupancy"
  ) {
      return null;
  }
  
  const title = TITLE_MAP[lastSegment] || 
    (lastSegment ? lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1) : "");

  return (
    <span className="text-[2vh] md:text-lg font-medium text-muted-foreground whitespace-nowrap">
      {title}
    </span>
  );
}
