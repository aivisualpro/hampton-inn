
import Image from "next/image";
import Link from "next/link";
import { PageTitle } from "@/components/layout/page-title";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-[5vh] min-h-[40px] items-center px-4">
        <div className="flex items-center">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <div className="relative h-[3vh] w-[3vh] min-h-[24px] min-w-[24px]">
                 <Image src="/logo.png" alt="Hamton Inn Logo" fill className="object-contain" />
              </div>
              <span className="text-[2vh] md:text-lg font-bold tracking-tight text-foreground/90 whitespace-nowrap">
                Hamton Inn
              </span>
            </Link>
            <PageTitle />
        </div>
        <div className="flex flex-1 items-center space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-[2vh] w-[2vh] min-h-[14px] min-w-[14px] text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="h-[3.5vh] min-h-[30px] w-full rounded-md border border-input bg-background pl-8 text-[1.5vh] md:text-sm sm:w-[300px] md:w-[400px] lg:w-[500px] focus-visible:ring-1"
              />
            </div>
          </div>
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="h-[3.5vh] w-[3.5vh] min-h-[30px] min-w-[30px] px-0 flex items-center justify-center">
               <span className="sr-only">Notifications</span>
               <div className="h-2 w-2 rounded-full bg-red-500 absolute top-1 right-1"></div>
            </Button>
            <div className="h-[3.5vh] w-[3.5vh] min-h-[30px] min-w-[30px] rounded-full bg-muted/50 border border-border"></div>
          </nav>
        </div>
      </div>
    </header>
  );
}
