"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Download,
  Search,
  CalendarDays,
} from "lucide-react";
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

type ReportData = {
  items: Item[];
  locations: Location[];
  stockMap: StockMap;
};

function getTodayString() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ClosingStockReportPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback((date: string, isInitial: boolean) => {
    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isInitial) setInitialLoading(true);
    else setRefreshing(true);

    fetch(`/api/reports/closing-stock?date=${date}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((result) => {
        setData(result);
        setInitialLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(err);
          setInitialLoading(false);
          setRefreshing(false);
        }
      });
  }, []);

  useEffect(() => {
    fetchData(selectedDate, !data);
  }, [selectedDate]);

  const goBack = () => {
    setSelectedDate((prev) => shiftDate(prev, -1));
  };

  const goForward = () => {
    const next = shiftDate(selectedDate, 1);
    if (next <= getTodayString()) setSelectedDate(next);
  };

  const goToday = () => setSelectedDate(getTodayString());

  const isToday = selectedDate === getTodayString();
  const canGoForward = shiftDate(selectedDate, 1) <= getTodayString();

  // --- Full-screen loading only on first load ---
  if (initialLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <div className="p-6">Error loading report</div>;

  const { items, locations, stockMap } = data;

  // Group Locations by Category
  const locationGroups: Record<string, Location[]> = {};
  locations.forEach((loc) => {
    const groupName = loc.category || loc.name;
    if (!locationGroups[groupName]) locationGroups[groupName] = [];
    locationGroups[groupName].push(loc);
  });
  const sortedGroupNames = Object.keys(locationGroups).sort((a, b) =>
    a.localeCompare(b)
  );

  // Helper to get stock
  const getStock = (itemId: string, locationId: string) =>
    stockMap[itemId]?.[locationId] || 0;

  // Filter items
  const filteredItems = items.filter(
    (i) =>
      i.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate rows
  const rows = filteredItems.map((item) => {
    const groupStocks: Record<string, number> = {};
    let totalStock = 0;
    sortedGroupNames.forEach((groupName) => {
      const groupLocs = locationGroups[groupName];
      const groupSum = groupLocs.reduce(
        (sum, loc) => sum + getStock(item._id, loc._id),
        0
      );
      groupStocks[groupName] = groupSum;
      totalStock += groupSum;
    });
    return { item, groupStocks, totalStock };
  });

  // --- Group rows by category, sorted alphabetically ---
  const categoryMap: Record<string, typeof rows> = {};
  rows.forEach((row) => {
    const cat = row.item.category || "Uncategorized";
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(row);
  });
  // Sort categories alphabetically
  const sortedCategories = Object.keys(categoryMap).sort((a, b) =>
    a.localeCompare(b)
  );
  // Sort items within each category alphabetically
  sortedCategories.forEach((cat) => {
    categoryMap[cat].sort((a, b) => a.item.item.localeCompare(b.item.item));
  });

  const totalColSpan = 2 + sortedGroupNames.length + 1;

  // Export CSV
  const handleExport = () => {
    const headers = [
      "Category",
      "Item",
      ...sortedGroupNames,
      "Total Inventory",
    ];
    const csvRows = [headers.join(",")];
    sortedCategories.forEach((cat) => {
      categoryMap[cat].forEach((row) => {
        const vals = [
          `"${row.item.category || ""}"`,
          `"${row.item.item}"`,
          ...sortedGroupNames.map((g) => row.groupStocks[g] || 0),
          row.totalStock,
        ];
        csvRows.push(vals.join(","));
      });
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `closing-stock-report-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="border-b bg-white px-6 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary hover:underline">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin" className="hover:text-primary hover:underline">
            Admin
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href="/admin/reports"
            className="hover:text-primary hover:underline"
          >
            Reports
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Closing Stock</span>
          {refreshing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 ml-1" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Navigator */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={goBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <input
                type="date"
                id="closing-stock-date"
                value={selectedDate}
                max={getTodayString()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 pl-8 pr-2 rounded-lg border border-input bg-background text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={goForward}
              disabled={!canGoForward}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full"
                onClick={goToday}
              >
                Today
              </Button>
            )}
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-gray-200 mx-1 hidden md:block" />

          {/* Search */}
          <div className="relative w-44">
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Search className="h-3.5 w-3.5" />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} className="h-8">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`flex-1 overflow-auto transition-opacity duration-200 ${
          refreshing ? "opacity-50" : "opacity-100"
        }`}
      >
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[220px] font-semibold bg-muted/50 pl-6">
                Item
              </TableHead>
              {sortedGroupNames.map((groupName) => (
                <TableHead
                  key={groupName}
                  className="text-center bg-gray-50 text-xs"
                >
                  {groupName}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold bg-green-50 text-green-700 pr-6">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCategories.map((category) => (
              <>
                {/* Category Header Row */}
                <TableRow key={`cat-${category}`} className="bg-gray-50/80 hover:bg-gray-100/60">
                  <TableCell
                    colSpan={totalColSpan}
                    className="pl-6 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {category}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        ({categoryMap[category].length})
                      </span>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Item Rows */}
                {categoryMap[category].map((row) => (
                  <TableRow
                    key={row.item._id}
                    className="hover:bg-blue-50/30 transition-colors duration-150"
                  >
                    <TableCell className="font-medium pl-10 py-2">
                      <Link
                        href={`/admin/items/${row.item._id}`}
                        className="hover:underline hover:text-primary text-sm"
                      >
                        {row.item.item}
                      </Link>
                    </TableCell>
                    {sortedGroupNames.map((groupName) => (
                      <TableCell
                        key={groupName}
                        className={`text-center text-sm tabular-nums ${
                          row.groupStocks[groupName] === 0
                            ? "text-gray-300"
                            : "text-gray-700"
                        }`}
                      >
                        {row.groupStocks[groupName]}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-center font-bold pr-6 text-sm tabular-nums ${
                        row.totalStock <= 0
                          ? "text-red-600 bg-red-50/50"
                          : "text-green-700 bg-green-50/20"
                      }`}
                    >
                      {row.totalStock}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
