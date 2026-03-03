"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Download,
  Search,
  CalendarDays,
  MapPin,
  Tag,
  Layers,
  X,
  Check,
  Filter,
  ListFilter,
  Package,
  ChevronDown,
  RotateCcw,
  Sparkles,
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
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

/* ─── Multi-select Filter Popover ────────────────────────────────── */
function FilterPopover({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  onClear,
  accentColor = "blue",
}: {
  label: string;
  icon: React.ElementType;
  options: { value: string; count: number }[];
  selected: string[];
  onToggle: (val: string) => void;
  onClear: () => void;
  accentColor?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    return options.filter((o) =>
      o.value.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const accentMap: Record<string, { bg: string; text: string; ring: string; dot: string; badge: string; hoverBg: string; lightBg: string }> = {
    blue: { bg: "bg-blue-500", text: "text-blue-600", ring: "ring-blue-500/20", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200", hoverBg: "hover:bg-blue-50/80", lightBg: "bg-blue-50/50" },
    violet: { bg: "bg-violet-500", text: "text-violet-600", ring: "ring-violet-500/20", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", hoverBg: "hover:bg-violet-50/80", lightBg: "bg-violet-50/50" },
    amber: { bg: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-500/20", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", hoverBg: "hover:bg-amber-50/80", lightBg: "bg-amber-50/50" },
    emerald: { bg: "bg-emerald-500", text: "text-emerald-600", ring: "ring-emerald-500/20", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", hoverBg: "hover:bg-emerald-50/80", lightBg: "bg-emerald-50/50" },
  };
  const accent = accentMap[accentColor] || accentMap.blue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`group relative flex items-center gap-2 h-9 px-3.5 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer
            ${
              selected.length > 0
                ? `${accent.lightBg} border-current/15 ${accent.text} shadow-sm ring-1 ${accent.ring}`
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50/80 hover:shadow-sm"
            }
          `}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
          {selected.length > 0 && (
            <span
              className={`flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold text-white ${accent.bg} shadow-sm`}
            >
              {selected.length}
            </span>
          )}
          <ChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] p-0 rounded-xl border shadow-xl bg-white/95 backdrop-blur-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-3.5 pt-3 pb-2 border-b bg-gradient-to-b from-gray-50/80 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${accent.dot}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {label}
              </span>
            </div>
            {selected.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-[10px] font-semibold text-red-500 hover:text-red-600 px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-gray-200 bg-white/80 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
            />
          </div>
        </div>

        {/* Options */}
        <div className="max-h-[260px] overflow-y-auto py-1.5 px-1.5">
          {filteredOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Search className="h-5 w-5 mb-2 opacity-50" />
              <p className="text-xs font-medium">No matches found</p>
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => onToggle(opt.value)}
                  className={`group/item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all duration-150  
                    ${
                      isChecked
                        ? `${accent.lightBg} ${accent.text} font-medium`
                        : `text-gray-600 hover:bg-gray-50 hover:text-gray-900`
                    }
                  `}
                >
                  <div
                    className={`flex items-center justify-center h-4 w-4 rounded-md border transition-all duration-200 shrink-0
                      ${
                        isChecked
                          ? `${accent.bg} border-transparent shadow-sm`
                          : "border-gray-300 bg-white group-hover/item:border-gray-400"
                      }
                    `}
                  >
                    {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className="truncate flex-1 text-left">{opt.value}</span>
                  <span
                    className={`text-[10px] tabular-nums shrink-0 font-medium px-1.5 py-0.5 rounded-md
                      ${isChecked ? `${accent.badge} border` : "text-gray-400 bg-gray-100/80"}
                    `}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer stats */}
        <div className="px-3.5 py-2 border-t bg-gray-50/50 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 font-medium">
            {selected.length} of {options.length} selected
          </span>
          <span className="text-[10px] text-gray-400">
            {filteredOptions.length} shown
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ClosingStockReportPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const abortRef = useRef<AbortController | null>(null);

  // Filter states
  const [selLocations, setSelLocations] = useState<string[]>([]);
  const [selCategories, setSelCategories] = useState<string[]>([]);
  const [selSubCategories, setSelSubCategories] = useState<string[]>([]);

  const fetchData = useCallback((date: string, isInitial: boolean) => {
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

  const goBack = () => setSelectedDate((prev) => shiftDate(prev, -1));
  const goForward = () => {
    const next = shiftDate(selectedDate, 1);
    if (next <= getTodayString()) setSelectedDate(next);
  };
  const goToday = () => setSelectedDate(getTodayString());

  const isToday = selectedDate === getTodayString();
  const canGoForward = shiftDate(selectedDate, 1) <= getTodayString();

  /* ───── Cascading filter computations ───── */
  const { items = [], locations = [], stockMap = {} } = data || {};

  // Unique Location group names (with counts based on other filters)
  const locationGroupNames = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    locations.forEach((loc) => {
      const groupName = loc.category || loc.name;
      if (!map[groupName]) map[groupName] = new Set();
      map[groupName].add(loc._id);
    });
    return map;
  }, [locations]);

  // Items filtered by Category + SubCategory only (for Location filter options)
  const itemsFilteredByCatSub = useMemo(() => {
    let filtered = items;
    if (selCategories.length > 0) {
      filtered = filtered.filter((i) => selCategories.includes(i.category || "Uncategorized"));
    }
    if (selSubCategories.length > 0) {
      filtered = filtered.filter((i) => selSubCategories.includes(i.subCategory || "Uncategorized"));
    }
    return filtered;
  }, [items, selCategories, selSubCategories]);

  // Location options
  const locationOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    const allGroupNames = Object.keys(locationGroupNames).sort();
    for (const gName of allGroupNames) {
      let count = 0;
      const locIds = locationGroupNames[gName];
      for (const item of itemsFilteredByCatSub) {
        for (const locId of locIds) {
          const s = stockMap[item._id]?.[locId] || 0;
          if (s !== 0) { count++; break; }
        }
      }
      counts[gName] = count;
    }
    return allGroupNames.map((v) => ({ value: v, count: counts[v] || 0 }));
  }, [locationGroupNames, itemsFilteredByCatSub, stockMap]);

  // Items filtered by Location only (for Category/Sub options)
  const itemsFilteredByLocation = useMemo(() => {
    if (selLocations.length === 0) return items;
    // get the union of location IDs for selected groups
    const selectedLocIds = new Set<string>();
    selLocations.forEach((gName) => {
      locationGroupNames[gName]?.forEach((id) => selectedLocIds.add(id));
    });
    // only keep items that have non-zero stock in at least one selected location
    return items.filter((item) => {
      for (const locId of selectedLocIds) {
        if ((stockMap[item._id]?.[locId] || 0) !== 0) return true;
      }
      return false;
    });
  }, [items, selLocations, locationGroupNames, stockMap]);

  // Category options (cascading: filtered by Location + SubCategory)
  const categoryOptions = useMemo(() => {
    let pool = itemsFilteredByLocation;
    if (selSubCategories.length > 0) {
      pool = pool.filter((i) => selSubCategories.includes(i.subCategory || "Uncategorized"));
    }
    const counts: Record<string, number> = {};
    pool.forEach((i) => {
      const cat = i.category || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [itemsFilteredByLocation, selSubCategories]);

  // SubCategory options (cascading: filtered by Location + Category)
  const subCategoryOptions = useMemo(() => {
    let pool = itemsFilteredByLocation;
    if (selCategories.length > 0) {
      pool = pool.filter((i) => selCategories.includes(i.category || "Uncategorized"));
    }
    const counts: Record<string, number> = {};
    pool.forEach((i) => {
      const sub = i.subCategory || "Uncategorized";
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [itemsFilteredByLocation, selCategories]);

  // Toggle helpers
  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    setter((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  // Clear subcategories when category changes (cascade)
  const handleCategoryToggle = (val: string) => {
    toggleFilter(setSelCategories, val);
    // Auto-clear any subcategories that won't exist in the new category set
  };

  const totalActiveFilters = selLocations.length + selCategories.length + selSubCategories.length;
  const clearAllFilters = () => {
    setSelLocations([]);
    setSelCategories([]);
    setSelSubCategories([]);
    setSearchQuery("");
  };

  /* ───── Filtered + derived data ───── */

  // Group Locations by Category
  const locationGroups = useMemo(() => {
    const groups: Record<string, Location[]> = {};
    locations.forEach((loc) => {
      const groupName = loc.category || loc.name;
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(loc);
    });
    return groups;
  }, [locations]);

  // Sorted group names, filtered by selected locations
  const sortedGroupNames = useMemo(() => {
    const allGroups = Object.keys(locationGroups).sort((a, b) => a.localeCompare(b));
    if (selLocations.length === 0) return allGroups;
    return allGroups.filter((g) => selLocations.includes(g));
  }, [locationGroups, selLocations]);

  const getStock = (itemId: string, locationId: string) =>
    stockMap[itemId]?.[locationId] || 0;

  // Final filtered items
  const filteredItems = useMemo(() => {
    let result = items;
    // Category filter
    if (selCategories.length > 0) {
      result = result.filter((i) => selCategories.includes(i.category || "Uncategorized"));
    }
    // SubCategory filter
    if (selSubCategories.length > 0) {
      result = result.filter((i) => selSubCategories.includes(i.subCategory || "Uncategorized"));
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.item.toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q) ||
          (i.subCategory || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, selCategories, selSubCategories, searchQuery]);

  // Calculate rows
  const rows = useMemo(() => {
    return filteredItems.map((item) => {
      const groupStocks: Record<string, number> = {};
      let totalStock = 0;
      sortedGroupNames.forEach((groupName) => {
        const groupLocs = locationGroups[groupName] || [];
        const groupSum = groupLocs.reduce(
          (sum, loc) => sum + getStock(item._id, loc._id),
          0
        );
        groupStocks[groupName] = groupSum;
        totalStock += groupSum;
      });
      return { item, groupStocks, totalStock };
    });
  }, [filteredItems, sortedGroupNames, locationGroups, stockMap]);

  // Group rows by category
  const { categoryMap, sortedCategories } = useMemo(() => {
    const map: Record<string, typeof rows> = {};
    rows.forEach((row) => {
      const cat = row.item.category || "Uncategorized";
      if (!map[cat]) map[cat] = [];
      map[cat].push(row);
    });
    const sorted = Object.keys(map).sort((a, b) => a.localeCompare(b));
    sorted.forEach((cat) => {
      map[cat].sort((a, b) => a.item.item.localeCompare(b.item.item));
    });
    return { categoryMap: map, sortedCategories: sorted };
  }, [rows]);

  const totalColSpan = 2 + sortedGroupNames.length + 1;

  // Summary stats
  const totalItems = filteredItems.length;
  const totalStockSum = rows.reduce((s, r) => s + r.totalStock, 0);
  const zeroStockItems = rows.filter((r) => r.totalStock <= 0).length;

  // Export CSV
  const handleExport = () => {
    const headers = [
      "Category",
      "Sub-Category",
      "Item",
      ...sortedGroupNames,
      "Total Inventory",
    ];
    const csvRows = [headers.join(",")];
    sortedCategories.forEach((cat) => {
      categoryMap[cat].forEach((row) => {
        const vals = [
          `"${row.item.category || ""}"`,
          `"${row.item.subCategory || ""}"`,
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

  /* ───── Full-screen initial loading ───── */
  if (initialLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            <div className="relative flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Loading Closing Stock</p>
            <p className="text-xs text-gray-400 mt-1">Crunching inventory data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6">Error loading report</div>;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50/80 via-white to-blue-50/30">
      {/* ───── Header ───── */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        {/* Breadcrumb row */}
        <div className="px-6 pt-3 pb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary hover:underline transition-colors">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/admin" className="hover:text-primary hover:underline transition-colors">Admin</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/admin/reports" className="hover:text-primary hover:underline transition-colors">Reports</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">Closing Stock</span>
          {refreshing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 ml-1" />
          )}
        </div>

        {/* Controls row */}
        <div className="px-6 pb-3 flex flex-col gap-3">
          {/* Top row: Date + Search + Export */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date Navigator */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={goBack}>
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
                  className="h-9 pl-8 pr-2 rounded-xl border border-input bg-background text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={goForward} disabled={!canGoForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full"
                  onClick={goToday}
                >
                  Today
                </Button>
              )}
            </div>

            <div className="h-5 w-px bg-gray-200 mx-0.5 hidden md:block" />

            {/* Search */}
            <div className="relative w-52">
              <Input
                placeholder="Search items, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-sm rounded-xl"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <Search className="h-3.5 w-3.5" />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExport} className="h-9 rounded-xl hidden md:inline-flex">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-1">
              <ListFilter className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Filters</span>
            </div>

            <FilterPopover
              label="Location"
              icon={MapPin}
              options={locationOptions}
              selected={selLocations}
              onToggle={(val) => toggleFilter(setSelLocations, val)}
              onClear={() => setSelLocations([])}
              accentColor="blue"
            />

            <FilterPopover
              label="Category"
              icon={Tag}
              options={categoryOptions}
              selected={selCategories}
              onToggle={handleCategoryToggle}
              onClear={() => {
                setSelCategories([]);
                setSelSubCategories([]);
              }}
              accentColor="violet"
            />

            <FilterPopover
              label="Sub-Category"
              icon={Layers}
              options={subCategoryOptions}
              selected={selSubCategories}
              onToggle={(val) => toggleFilter(setSelSubCategories, val)}
              onClear={() => setSelSubCategories([])}
              accentColor="amber"
            />

            {totalActiveFilters > 0 && (
              <>
                <div className="h-5 w-px bg-gray-200 mx-1" />
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset all
                </button>
              </>
            )}

            {/* Quick Stats - right side */}
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden md:flex items-center gap-4 px-4 py-1.5 rounded-xl bg-gradient-to-r from-gray-50 to-slate-50/50 border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-[11px] text-gray-500">Items</span>
                  <span className="text-xs font-bold text-gray-800 tabular-nums">{totalItems}</span>
                </div>
                <div className="h-3.5 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-gray-500">Total Stock</span>
                  <span className="text-xs font-bold text-gray-800 tabular-nums">{totalStockSum.toLocaleString()}</span>
                </div>
                <div className="h-3.5 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-[11px] text-gray-500">Out of Stock</span>
                  <span className="text-xs font-bold text-red-600 tabular-nums">{zeroStockItems}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active filter badges */}
          {totalActiveFilters > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 -mt-1">
              {selLocations.map((loc) => (
                <Badge
                  key={`loc-${loc}`}
                  variant="secondary"
                  className="h-6 rounded-lg gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer pr-1"
                  onClick={() => toggleFilter(setSelLocations, loc)}
                >
                  <MapPin className="h-2.5 w-2.5" />
                  {loc}
                  <X className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                </Badge>
              ))}
              {selCategories.map((cat) => (
                <Badge
                  key={`cat-${cat}`}
                  variant="secondary"
                  className="h-6 rounded-lg gap-1 text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer pr-1"
                  onClick={() => toggleFilter(setSelCategories, cat)}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {cat}
                  <X className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                </Badge>
              ))}
              {selSubCategories.map((sub) => (
                <Badge
                  key={`sub-${sub}`}
                  variant="secondary"
                  className="h-6 rounded-lg gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer pr-1"
                  onClick={() => toggleFilter(setSelSubCategories, sub)}
                >
                  <Layers className="h-2.5 w-2.5" />
                  {sub}
                  <X className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ───── Content: Table ───── */}
      <div
        className={`flex-1 overflow-auto transition-opacity duration-300 ${
          refreshing ? "opacity-40 pointer-events-none" : "opacity-100"
        }`}
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gray-100 mb-4">
              <Package className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500 mb-1">No items found</p>
            <p className="text-xs text-gray-400">Try adjusting your filters or search query</p>
            {totalActiveFilters > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="mt-4 h-8 text-xs rounded-lg"
                onClick={clearAllFilters}
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-white/90 backdrop-blur-sm sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <TableRow className="border-b-2 border-gray-100">
                <TableHead className="w-[240px] font-bold bg-white/90 backdrop-blur-sm pl-6 text-gray-700">
                  Item
                </TableHead>
                {sortedGroupNames.map((groupName) => (
                  <TableHead
                    key={groupName}
                    className="text-center bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {groupName}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 pr-6 text-xs">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCategories.map((category) => (
                <>
                  {/* Category Header Row */}
                  <TableRow
                    key={`cat-${category}`}
                    className="bg-gradient-to-r from-slate-50/80 to-gray-50/40 hover:from-slate-100/80 border-t-2 border-gray-100/60"
                  >
                    <TableCell colSpan={totalColSpan} className="pl-6 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 shadow-sm shadow-violet-500/30" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                          {category}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold bg-white/80 px-2 py-0.5 rounded-full border border-gray-100">
                          {categoryMap[category].length} items
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Item Rows */}
                  {categoryMap[category].map((row, idx) => (
                    <TableRow
                      key={row.item._id}
                      className={`hover:bg-blue-50/40 transition-colors duration-150 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      <TableCell className="font-medium pl-10 py-2.5">
                        <Link
                          href={`/admin/items/${row.item._id}`}
                          className="hover:underline hover:text-blue-600 text-sm text-gray-800 transition-colors"
                        >
                          {row.item.item}
                        </Link>
                        {row.item.subCategory && (
                          <span className="ml-2 text-[10px] text-gray-400 font-medium bg-gray-100/80 px-1.5 py-0.5 rounded">
                            {row.item.subCategory}
                          </span>
                        )}
                      </TableCell>
                      {sortedGroupNames.map((groupName) => (
                        <TableCell
                          key={groupName}
                          className={`text-center text-sm tabular-nums transition-colors ${
                            row.groupStocks[groupName] === 0
                              ? "text-gray-300"
                              : row.groupStocks[groupName] < 0
                              ? "text-red-500 font-semibold"
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
                            : "text-emerald-700 bg-emerald-50/20"
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
        )}
      </div>
    </div>
  );
}
