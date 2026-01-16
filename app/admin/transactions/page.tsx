"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronRight, Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

type Transaction = {
  _id: string;
  date: string;
  item: string; // ID
  location: string; // ID
  countedUnit: number;
  soakUnit: number;
  consumedUnit: number;
  createdAt: string;
};

type Item = {
  _id: string;
  item: string;
};

type Location = {
  _id: string;
  name: string;
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [transRes, itemsRes, locRes] = await Promise.all([
          fetch("/api/transactions"),
          fetch("/api/items"),
          fetch("/api/locations"),
        ]);

        if (!transRes.ok) throw new Error("Failed to fetch transactions");
        const transData = await transRes.json();
        setTransactions(transData);

        if (itemsRes.ok) {
          const itemsData: Item[] = await itemsRes.json();
          const itemMap: Record<string, string> = {};
          itemsData.forEach((i) => (itemMap[i._id] = i.item));
          setItems(itemMap);
        }

        if (locRes.ok) {
          const locData: Location[] = await locRes.json();
          const locMap: Record<string, string> = {};
          locData.forEach((l) => (locMap[l._id] = l.name));
          setLocations(locMap);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter and Paginate
  const filteredTransactions = transactions.filter(t => {
      const itemName = items[t.item] || "Unknown Item";
      const locName = locations[t.location] || "Unknown Location";
      const query = searchQuery.toLowerCase();
      
      return (
          itemName.toLowerCase().includes(query) ||
          locName.toLowerCase().includes(query)
      );
  });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none h-[6%] min-h-[50px] border-b flex items-center justify-between gap-4 px-4 bg-white z-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Transactions</span>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-sm w-full md:w-64">
             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               type="search"
               placeholder="Search transactions..."
               className="w-full bg-background pl-8 h-8 text-sm"
               value={searchQuery}
               onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
             />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
          <div className="flex-1 overflow-auto bg-white">
            <Table>
                <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                    <TableRow className="bg-gray-50/50 border-b">
                        <TableHead className="w-[150px] pl-4">Date</TableHead>
                        <TableHead className="w-[200px]">Location</TableHead>
                        <TableHead className="w-[200px]">Item</TableHead>
                        <TableHead className="text-right">Counted</TableHead>
                        <TableHead className="text-right">Soak</TableHead>
                        <TableHead className="text-right">Disposed</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                         <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : paginatedTransactions.length === 0 ? (
                        <TableRow>
                             <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                No transactions found.
                             </TableCell>
                        </TableRow>
                    ) : (
                        paginatedTransactions.map((t) => (
                            <TableRow key={t._id} className="hover:bg-muted/50 border-b">
                                <TableCell className="pl-4 font-medium text-sm">
                                    {format(new Date(t.date), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell className="text-sm">
                                    {locations[t.location] || t.location}
                                </TableCell>
                                <TableCell className="text-sm font-medium text-gray-700">
                                    {items[t.item] || t.item}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                    {t.countedUnit}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-blue-600">
                                    {t.soakUnit > 0 ? t.soakUnit : "-"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-red-600">
                                    {t.consumedUnit > 0 ? t.consumedUnit : "-"}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
          </div>
      </div>
    </div>
  );
}
