
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Item = {
  _id: string;
  item: string;
  category: string;
  subCategory?: string;
  package?: string;
};

type Location = {
  _id: string;
  name: string;
  category?: string;
};

type StockMap = Record<string, Record<string, number>>;

export default function ClosingStockReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    items: Item[];
    locations: Location[];
    stockMap: StockMap;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/reports/closing-stock", { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <div>Error loading report</div>;

  const { items, locations, stockMap } = data;

  // Group Locations by Category
  const locationGroups: Record<string, Location[]> = {};
  locations.forEach(loc => {
    const groupName = loc.category || loc.name;
    if (!locationGroups[groupName]) locationGroups[groupName] = [];
    locationGroups[groupName].push(loc);
  });

  const sortedGroupNames = Object.keys(locationGroups).sort((a, b) => a.localeCompare(b));

  // Helper to get package size
  const getPackageSize = (packageStr?: string): number => {
    if (!packageStr) return 1;
    const match = packageStr.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 1;
  };

  // Helper to get stock
  const getStock = (itemId: string, locationId: string) => {
    return stockMap[itemId]?.[locationId] || 0;
  };

  // Filter Items
  const filteredItems = items.filter(i =>
    i.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate rows
  const rows = filteredItems.map((item) => {
    const groupStocks: Record<string, number> = {};
    let totalStock = 0;

    sortedGroupNames.forEach(groupName => {
      const groupLocs = locationGroups[groupName];
      const groupSum = groupLocs.reduce((sum, loc) => sum + getStock(item._id, loc._id), 0);
      groupStocks[groupName] = groupSum;
      totalStock += groupSum;
    });

    return {
      item,
      groupStocks,
      totalStock,
    };
  });

  // Export CSV
  const handleExport = () => {
    const headers = ["Item", "Category", ...sortedGroupNames, "Total Inventory"];
    const csvRows = [headers.join(",")];
    rows.forEach(row => {
      const vals = [
        `"${row.item.item}"`,
        `"${row.item.category || ""}"`,
        ...sortedGroupNames.map(g => row.groupStocks[g] || 0),
        row.totalStock,
      ];
      csvRows.push(vals.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `closing-stock-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin/reports" className="hover:text-primary hover:underline">Reports</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Closing Stock Report</span>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="relative w-64">
                <Input 
                    placeholder="Search items..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                     <Search className="h-4 w-4" />
                </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[200px] font-semibold bg-muted/50 pl-6">Item</TableHead>
              <TableHead className="text-center bg-muted/50 w-[100px]">Category</TableHead>
              
              {/* Dynamic Location Group Columns */}
              {sortedGroupNames.map(groupName => (
                <TableHead key={groupName} className="text-center bg-gray-50">{groupName}</TableHead>
              ))}

              <TableHead className="text-center font-bold bg-green-50 text-green-700 pr-6">Total Inventory</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.item._id} className="hover:bg-muted/50">
                <TableCell className="font-medium pl-6">
                  <Link href={`/admin/items/${row.item._id}`} className="hover:underline hover:text-primary">
                    {row.item.item}
                  </Link>
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{row.item.category}</TableCell>
                
                {sortedGroupNames.map(groupName => (
                  <TableCell key={groupName} className={`text-center ${row.groupStocks[groupName] === 0 ? 'text-gray-300' : ''}`}>
                    {row.groupStocks[groupName]}
                  </TableCell>
                ))}

                <TableCell className={`text-center font-bold pr-6 ${row.totalStock <= 0 ? 'text-red-600 bg-red-50/50' : 'text-green-700 bg-green-50/20'}`}>
                  {row.totalStock}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
