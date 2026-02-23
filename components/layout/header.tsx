"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { PageTitle } from "@/components/layout/page-title";
import { User, LogOut, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || pathname === "/login") return null;

  const isHome = pathname === "/";
  const isDeepPage = pathname.split("/").filter(Boolean).length > 1;

  return (
    <header className="flex-none z-50 w-full bg-white/80 backdrop-blur-xl border-b border-gray-200/60" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="w-full flex h-14 items-center px-4 relative">

        {/* Left: Logo (home) or Back button (inner pages) */}
        <div className="flex items-center min-w-[120px]">
          {isHome ? (
            <Link href="/" className="flex items-center group">
              <div className="relative h-10 w-28 transition-transform duration-200 group-hover:scale-105">
                <Image
                  src="/logo.png"
                  alt="Hampton by Hilton"
                  fill
                  sizes="112px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl hover:bg-gray-100/80 transition-all duration-200"
                onClick={() => router.back()}
              >
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              </Button>
              <Link href="/" className="flex items-center">
                <div className="relative h-8 w-20 opacity-70 hover:opacity-100 transition-opacity duration-200">
                  <Image
                    src="/logo.png"
                    alt="Hampton by Hilton"
                    fill
                    sizes="80px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Center: Route Title — absolute positioned for true centering */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <PageTitle />
        </div>

        {/* Right: User Menu */}
        <div className="ml-auto flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-9 w-9 hover:bg-gray-100/80 transition-all duration-200"
              >
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200/80 flex items-center justify-center overflow-hidden transition-all duration-200 hover:from-gray-200 hover:to-gray-300 hover:shadow-sm">
                  <span className="sr-only">User menu</span>
                  <User className="h-4 w-4 text-gray-500" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border-gray-200/60">
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="cursor-pointer rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50"
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
