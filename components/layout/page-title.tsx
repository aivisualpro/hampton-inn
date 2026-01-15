
"use client";

import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  admin: "Administration",
  users: "Users",
  items: "Items",
  settings: "Settings",
};

export function PageTitle() {
  const pathname = usePathname();
  
  // Don't show on home page
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  
  const title = TITLE_MAP[lastSegment] || 
    (lastSegment ? lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1) : "");

  return (
    <span className="ml-4 pl-4 border-l border-border text-[2vh] md:text-lg font-medium text-muted-foreground whitespace-nowrap">
      {title}
    </span>
  );
}
