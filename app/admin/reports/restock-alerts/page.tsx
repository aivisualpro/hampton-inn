
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Download, Search, AlertTriangle, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Alert = {
  _id: string;
  item: string;
  category: string;
  subCategory?: string;
  package?: string;
  costPerPackage: number;
  restockPackageQty: number;
  currentTotalUnits: number;
  currentPackages: number;
  currentUnitsRemainder: number;
  needsRestock: boolean;
  deficit: number;
  estimatedCost: number;
};

type Summary = {
  totalItems: number;
  needsRestock: number;
  totalEstimatedCost: number;
};

export default function RestockAlertsPage() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "restock" | "ok">("all");

  useEffect(() => {
    fetch("/api/reports/restock-alerts", { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setAlerts(data.alerts || []);
        setSummary(data.summary || null);
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

  // Filter
  const filteredAlerts = alerts.filter(a => {
    const matchesSearch = a.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === "all" || 
      (filterMode === "restock" && a.needsRestock) ||
      (filterMode === "ok" && !a.needsRestock);
    return matchesSearch && matchesFilter;
  });

  // Export CSV
  const handleExport = () => {
    const headers = ["Item", "Category", "Package", "Restock Threshold (Pkg)", "Current Stock (Pkg)", "Current Remainder (Units)", "Needs Restock", "Deficit (Pkg)", "Estimated Cost"];
    const csvRows = [headers.join(",")];
    filteredAlerts.forEach(a => {
      csvRows.push([
        `"${a.item}"`,
        `"${a.category || ""}"`,
        `"${a.package || ""}"`,
        a.restockPackageQty,
        a.currentPackages,
        a.currentUnitsRemainder,
        a.needsRestock ? "YES" : "No",
        a.deficit,
        `$${a.estimatedCost.toFixed(2)}`
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restock-alerts-${new Date().toISOString().split("T")[0]}.csv`;
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
          <span className="font-medium text-foreground">Restock Alerts</span>
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

      {/* Summary Cards */}
      {summary && (
        <div className="border-b bg-white px-6 py-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setFilterMode("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterMode === "all" ? "bg-gray-100 ring-1 ring-gray-300" : "hover:bg-gray-50"
              }`}
            >
              <Package className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">All Items</span>
              <Badge variant="secondary" className="ml-1">{summary.totalItems}</Badge>
            </button>
            <button
              onClick={() => setFilterMode("restock")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterMode === "restock" ? "bg-red-50 ring-1 ring-red-200" : "hover:bg-red-50/50"
              }`}
            >
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-red-700">Needs Restock</span>
              <Badge variant="destructive" className="ml-1">{summary.needsRestock}</Badge>
            </button>
            <button
              onClick={() => setFilterMode("ok")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterMode === "ok" ? "bg-green-50 ring-1 ring-green-200" : "hover:bg-green-50/50"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-green-700">Stocked</span>
              <Badge className="ml-1 bg-green-100 text-green-700 hover:bg-green-100">{summary.totalItems - summary.needsRestock}</Badge>
            </button>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Est. Restock Cost:</span>
              <span className="font-bold text-red-600 text-lg">${summary.totalEstimatedCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[50px] text-center bg-muted/50 pl-4">Status</TableHead>
              <TableHead className="font-semibold bg-muted/50 pl-4">Item</TableHead>
              <TableHead className="text-center bg-muted/50 w-[100px]">Category</TableHead>
              <TableHead className="text-center bg-muted/50 w-[100px]">Package</TableHead>
              <TableHead className="text-center bg-blue-50 text-blue-700 font-bold w-[120px]">Restock Threshold</TableHead>
              <TableHead className="text-center bg-gray-50 w-[120px]">Current Stock</TableHead>
              <TableHead className="text-center bg-red-50 text-red-700 font-bold w-[100px]">Deficit</TableHead>
              <TableHead className="text-center bg-amber-50 text-amber-700 font-bold w-[120px] pr-6">Est. Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAlerts.map((alert) => (
              <TableRow key={alert._id} className={`hover:bg-muted/50 ${alert.needsRestock ? 'bg-red-50/30' : ''}`}>
                <TableCell className="text-center pl-4">
                  {alert.needsRestock ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="font-medium pl-4">
                  <Link href={`/admin/items/${alert._id}`} className="hover:underline hover:text-primary">
                    {alert.item}
                  </Link>
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{alert.category}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{alert.package || "-"}</TableCell>
                <TableCell className="text-center font-semibold text-blue-700 bg-blue-50/20">
                  {alert.restockPackageQty} pkg
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center">
                    <span className={`font-bold ${alert.needsRestock ? 'text-red-600' : 'text-green-600'}`}>
                      {alert.currentPackages} pkg
                    </span>
                    {alert.currentUnitsRemainder > 0 && (
                      <span className="text-xs text-muted-foreground">+ {alert.currentUnitsRemainder} units</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`text-center font-bold ${alert.deficit > 0 ? 'text-red-600 bg-red-50/30' : 'text-gray-300'}`}>
                  {alert.deficit > 0 ? `${alert.deficit} pkg` : "—"}
                </TableCell>
                <TableCell className={`text-center font-semibold pr-6 ${alert.estimatedCost > 0 ? 'text-amber-700' : 'text-gray-300'}`}>
                  {alert.estimatedCost > 0 ? `$${alert.estimatedCost.toFixed(2)}` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
