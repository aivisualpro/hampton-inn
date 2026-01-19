"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { PageTitle } from "@/components/layout/page-title";
import { Search, X, User, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setSearchQuery("");
        setResults([]);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search items
      const itemsRes = await fetch("/api/items");
      if (itemsRes.ok) {
        const items = await itemsRes.json();
        const filtered = items.filter((item: any) =>
          item.item?.toLowerCase().includes(query.toLowerCase()) ||
          item.category?.toLowerCase().includes(query.toLowerCase()) ||
          item.subCategory?.toLowerCase().includes(query.toLowerCase()) ||
          item.package?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5).map((item: any) => ({
          ...item,
          type: "item",
          href: "/admin/items"
        }));
        setResults(filtered);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: any) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setResults([]);
    // Navigate with query param to filter on the destination page
    const params = new URLSearchParams();
    params.set("q", result.item);
    router.push(`${result.href}?${params.toString()}`);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  /* Search functionality preserved in state but hidden from UI per request */
  
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white backdrop-blur supports-[backdrop-filter]:bg-white/95 pt-14 md:pt-4">
      <div className="w-full flex h-12 items-center px-4">
        {/* Logo and Name: 50% mobile, 20% desktop */}
        <div className="w-[50%] md:w-[20%] flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="relative h-8 w-8">
                 <Image src="/logo.png" alt="Hampton Inn Logo" fill sizes="32px" className="object-contain" unoptimized />
              </div>
              <span className="text-base md:text-lg font-bold tracking-tight text-gray-900 whitespace-nowrap">
                Hampton Inn
              </span>
            </Link>
        </div>

        {/* Route Title: hidden on mobile, 20% desktop */}
        <div className="hidden md:flex md:w-[20%] items-center">
           <PageTitle />
        </div>

        {/* Empty space: hidden on mobile, 50% on desktop */}
        <div className="hidden md:block md:w-[50%]"></div>

        {/* User Avatar with Dropdown: 50% mobile, 10% desktop */}
        <div className="w-[50%] md:w-[10%] flex justify-end items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                  <span className="sr-only">User menu</span>
                  <User className="h-5 w-5 text-gray-500" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem 
                onClick={handleLogout}
                disabled={loggingOut}
                className="cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOut ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
