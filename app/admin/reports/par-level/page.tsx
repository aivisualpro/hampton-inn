
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Download } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = {
  _id: string;
  item: string;
  defaultKingRoomQty: number;
  defaultDoubleQueenQty: number;
};

type Location = {
  _id: string;
  name: string;
  category?: string;
};

type Settings = {
  defaultKingRoomCount: number;
  defaultDoubleQueenRoomCount: number;
  parLevelThreshold?: number;
};

type StockMap = Record<string, Record<string, number>>; // itemId -> locationId -> count

export default function ParLevelReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    items: Item[];
    locations: Location[];
    settings: Settings;
    stockMap: StockMap;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/reports/par-level")
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

  const { items, locations, settings, stockMap } = data;

  // Group Locations by Category or Name
  // If a location has a category, we group by that category.
  // If not, we fall back to the location name (effectively a single column for that location).
  const locationGroups: Record<string, Location[]> = {};
  
  locations.forEach(loc => {
      // Use category if available, otherwise use location name
      const groupName = loc.category || loc.name;
      if (!locationGroups[groupName]) {
          locationGroups[groupName] = [];
      }
      locationGroups[groupName].push(loc);
  });

  // Sort groups: "Maid Closets" first if it exists, then alphabetical?
  // Or just alphabetical. Let's do alphabetical for consistency.
  const sortedGroupNames = Object.keys(locationGroups).sort((a, b) => {
      // Optional: Force "Maid Closets" to be early or specific order? 
      // User didn't specify order, but alphabetical is safe.
      return a.localeCompare(b);
  });

  // Helper to get stock
  const getStock = (itemId: string, locationId: string) => {
      return stockMap[itemId]?.[locationId] || 0;
  };

  const calculateRow = (item: Item) => {
      const kingNeeded = (item.defaultKingRoomQty || 0) * (settings.defaultKingRoomCount || 0);
      const queenNeeded = (item.defaultDoubleQueenQty || 0) * (settings.defaultDoubleQueenRoomCount || 0);
      const totalNeeded = kingNeeded + queenNeeded;

      const groupStocks: Record<string, number> = {};
      let totalStockAllLocations = 0;

      // Calculate stock for each group
      sortedGroupNames.forEach(groupName => {
          const groupLocs = locationGroups[groupName];
          const groupSum = groupLocs.reduce((sum, loc) => sum + getStock(item._id, loc._id), 0);
          groupStocks[groupName] = groupSum;
          totalStockAllLocations += groupSum;
      });
      
      const parLevel = totalNeeded > 0 ? (1 + (totalStockAllLocations / totalNeeded)).toFixed(2) : "N/A";

      return {
          item,
          kingNeeded,
          queenNeeded,
          totalNeeded,
          groupStocks,
          totalStockAllLocations,
          parLevel
      };
  };

  // Filter Items
  const filteredItems = items ? items.filter(i => i.item.toLowerCase().includes(searchQuery.toLowerCase())) : [];

  const rows = filteredItems.map(calculateRow);

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
          <span className="font-medium text-foreground">Par Level Report</span>
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
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
            </div>
            {/* Export Button Placeholder */}
            <Button size="sm" variant="outline">
                <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-0 overflow-auto">
        <Card className="rounded-none border-0 shadow-none">
            <CardContent className="p-0">
                <div className="border-b">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[200px] font-semibold bg-muted/50 pl-6">Item</TableHead>
                                <TableHead className="text-center bg-muted/50">King Room Qty</TableHead>
                                <TableHead className="text-center bg-muted/50">Dbl Queen Qty</TableHead>
                                <TableHead className="text-center font-bold bg-blue-50 text-blue-700">Total Needed</TableHead>
                                
                                {/* Dynamic Group Columns */}
                                {sortedGroupNames.map(groupName => (
                                    <TableHead key={groupName} className="text-center bg-gray-50">{groupName}</TableHead>
                                ))}

                                <TableHead className="text-center font-bold bg-gray-100 text-gray-800">Total Inventory</TableHead>
                                <TableHead className="text-center font-bold bg-green-50 text-green-700 pr-6">Par Level</TableHead>
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
                                    <TableCell className="text-center text-muted-foreground">{row.item.defaultKingRoomQty}</TableCell>
                                    <TableCell className="text-center text-muted-foreground">{row.item.defaultDoubleQueenQty}</TableCell>
                                    <TableCell className="text-center font-semibold bg-blue-50/20 text-blue-700">{row.totalNeeded}</TableCell>
                                    
                                    {sortedGroupNames.map(groupName => (
                                        <TableCell key={groupName} className="text-center bg-gray-50/20">
                                            {row.groupStocks[groupName]}
                                        </TableCell>
                                    ))}

                                    <TableCell className="text-center font-bold bg-gray-100/50">{row.totalStockAllLocations}</TableCell>
                                    <TableCell className={`text-center font-bold pr-6 ${
                                        row.parLevel === 'N/A' 
                                            ? '' 
                                            : parseFloat(row.parLevel) < (settings.parLevelThreshold ?? 1) 
                                                ? 'text-red-600' 
                                                : 'text-green-600'
                                    }`}>
                                        {row.parLevel}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
