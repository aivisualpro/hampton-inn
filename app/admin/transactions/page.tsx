"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TransactionsList } from "@/components/transactions/TransactionsList";

export default function TransactionsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50/50">
       {/* Mobile Header Breadcrumbs */}
       <div className="md:hidden px-4 py-3 bg-white border-b flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground">Admin</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Transactions</span>
       </div>

       <div className="flex-1 overflow-hidden">
           <TransactionsList 
             headerContent={
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link href="/" className="hover:text-primary hover:underline">Home</Link>
                    <ChevronRight className="h-4 w-4" />
                    <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
                    <ChevronRight className="h-4 w-4" />
                    <span className="font-medium text-foreground">Transactions</span>
                </div>
             }
           />
       </div>
    </div>
  );
}
