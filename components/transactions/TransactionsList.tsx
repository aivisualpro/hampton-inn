"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Loader2, ChevronRight, Search, Pencil, Trash2, MoreHorizontal, Calendar as CalendarIcon, Filter, X, Save, Box, Circle, Droplets, ShoppingCart, BedDouble, ClipboardList } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { format } from "date-fns";

type Transaction = {
  _id: string;
  date: string;
  item: string; // ID
  location: string; // ID
  countedUnit: number; // Closing Count
  countedPackage?: number;
  soakUnit: number;
  soakPackage?: number;
  consumedUnit: number;
  consumedPackage?: number;
  purchasedUnit?: number;
  purchasedPackage?: number;
  createdAt: string;
  relatedParentItem?: string;
  source?: string;
};

const TransactionIcon = ({ t }: { t: Partial<Transaction> }) => {
    const icons = [];
    
    // If source is Soak Cycle, show purely the Droplets icon
    if (t.source === "Soak Cycle") {
         icons.push(<Droplets key="soak" className="h-4 w-4 text-cyan-500" />);
    } else {
        // Standard logic for other transactions
        if ((t.soakUnit || 0) > 0) {
            icons.push(<Droplets key="soak" className="h-4 w-4 text-cyan-500" />);
        }
        if (((t.purchasedUnit || 0) > 0 || (t.purchasedPackage || 0) > 0) && t.source !== "Stock Count") {
            icons.push(<ShoppingCart key="buy" className="h-4 w-4 text-blue-600" />);
        }
        // Consumed usually means Daily Occupancy/Used
        if ((t.consumedUnit || 0) > 0 && t.source !== "Stock Count") {
            icons.push(<BedDouble key="use" className="h-4 w-4 text-orange-500" />);
        }

        // If explicit Stock Count source, OR no other icons, show Count icon
        if (t.source === "Stock Count" || icons.length === 0) {
            icons.push(<ClipboardList key="count" className="h-4 w-4 text-teal-600" />);
        }
    }

    return <div className="flex gap-1 items-center justify-center">{icons}</div>;
};

type Item = {
  _id: string;
  item: string;
  package?: string; // e.g. "Case of 12"
};

type Location = {
  _id: string;
  name: string;
};

interface TransactionsListProps {
    itemId?: string;
    headerContent?: React.ReactNode;
}

export function TransactionsList({ itemId, headerContent }: TransactionsListProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [totalStockMap, setTotalStockMap] = useState<Record<string, { totalUnit: number; totalPackage: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLocation, setFilterLocation] = useState("ALL");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  
  // Mass Edit State
  const [isMassEditMode, setIsMassEditMode] = useState(false);
  const [massEditedTransactions, setMassEditedTransactions] = useState<Record<string, Partial<Transaction>>>({});
  
  // Infinite Scroll state
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Edit State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const { toast } = useToast();
  
  // Delete Dialog State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleMassEdit = () => {
      if (isMassEditMode) {
          setIsMassEditMode(false);
          setMassEditedTransactions({});
      } else {
          setIsMassEditMode(true);
      }
  };

  const handleMassEditChange = (id: string, field: keyof Transaction, value: any) => {
      setMassEditedTransactions(prev => ({
          ...prev,
          [id]: {
              ...prev[id],
              [field]: value
          }
      }));
  };

  const saveMassEdit = async () => {
      const updates = Object.entries(massEditedTransactions).map(([id, changes]) => ({
          _id: id,
          ...changes
      }));

      if (updates.length === 0) {
          setIsMassEditMode(false);
          return;
      }

      setSaveLoading(true);
      try {
          await Promise.all(updates.map(u => 
              fetch(`/api/transactions/${u._id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(u)
              })
          ));
          
          await fetchData(); // Refresh all data
          setIsMassEditMode(false);
          setMassEditedTransactions({});
          toast({ title: "Updated", description: "Transactions updated successfully." });
      } catch (e) {
          console.error(e);
          toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
      } finally {
          setSaveLoading(false);
      }
  };

  const toggleAll = () => {
    if (selectedIds.size === displayedTransactions.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(displayedTransactions.map(t => t._id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    // Optimistic
    const prev = [...transactions];
    const idsToDelete = Array.from(selectedIds);
    
    if (!window.confirm(`Delete ${idsToDelete.length} transactions?`)) return;

    setTransactions(prev => prev.filter(t => !selectedIds.has(t._id)));
    setSelectedIds(new Set());
    toast({ title: "Deleted", description: `Deleting ${idsToDelete.length} transactions...` });

    try {
        await Promise.all(idsToDelete.map(id => fetch(`/api/transactions/${id}`, { method: "DELETE" })));
        toast({ title: "Success", description: "Transactions deleted." });
    } catch(e) {
        console.error(e);
        setTransactions(prev); // Revert
        toast({ variant: "destructive", title: "Error", description: "Failed to delete items." });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = itemId ? `/api/transactions?item=${itemId}` : "/api/transactions";
      const [transRes, itemsRes, locRes, stockRes] = await Promise.all([
        fetch(url),
        fetch("/api/items"),
        fetch("/api/locations"),
        fetch("/api/stock/current"),
      ]);

      if (!transRes.ok) throw new Error("Failed to fetch transactions");
      const transData = await transRes.json();
      setTransactions(transData);

      if (itemsRes.ok) {
        const itemsData: Item[] = await itemsRes.json();
        const itemMap: Record<string, Item> = {};
        itemsData.forEach((i) => (itemMap[i._id] = i)); // Store full item object
        setItems(itemMap);
      }

      if (locRes.ok) {
        const locData: Location[] = await locRes.json();
        const locMap: Record<string, string> = {};
        locData.forEach((l) => (locMap[l._id] = l.name));
        setLocations(locMap);
      }

      if (stockRes.ok) {
          const stockData = await stockRes.json();
          const stockMap: Record<string, { totalUnit: number; totalPackage: number }> = {};
          stockData.forEach((s: any) => {
              stockMap[s.item] = { totalUnit: s.totalUnit, totalPackage: s.totalPackage };
          });
          setTotalStockMap(stockMap);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [itemId]);

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction({ ...t });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setTransactionToDelete(id);
      setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    const id = transactionToDelete;
    setIsDeleteDialogOpen(false); // Close dialog immediately
    setTransactionToDelete(null);

    // Optimistic Update
    const prevTransactions = [...transactions];
    setTransactions(prev => prev.filter(t => t._id !== id));
    toast({ title: "Transaction deleted", description: "The transaction has been removed." });

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed");
      }
    } catch (e) {
      console.error(e);
      // Revert
      setTransactions(prevTransactions);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete transaction." });
    }
  };

  const handleUpdate = async () => {
    if (!editingTransaction) return;
    
    // Optimistic Update
    const prevTransactions = [...transactions];
    setTransactions(prev => prev.map(t => t._id === editingTransaction._id ? editingTransaction : t));
    
    setIsEditDialogOpen(false);
    setEditingTransaction(null);
    
    toast({ title: "Transaction updated", description: "Changes have been applied." });

    setSaveLoading(true);
    try {
      const res = await fetch(`/api/transactions/${editingTransaction._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTransaction),
      });

      if (!res.ok) {
        throw new Error("Failed update");
      }
    } catch (e) {
      console.error(e);
      // Revert
      setTransactions(prevTransactions);
      toast({ variant: "destructive", title: "Update failed", description: "Reverting changes." });
    } finally {
      setSaveLoading(false);
    }
  };

  // Calculate Running Balances
  const balanceMap = useMemo(() => {
    const map = new Map<string, { opening: number, closing: number, openingPkg: number, closingPkg: number, totalBalanceUnit: number, totalBalancePkg: number }>();
    const runningTotals: Record<string, { unit: number, pkg: number }> = {}; // Key: location_item
    const globalTotals: Record<string, { unit: number, pkg: number }> = {}; // Key: item

    // 1. Sort valid transactions chronologically
    const sorted = [...transactions].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // Secondary sort by creation time if available, or fallback to default order (assuming stable fetch)
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdA - createdB;
    });

    // 2. Compute running totals
    sorted.forEach(t => {
        const key = `${t.location}_${t.item}`;
        const itemKey = t.item;
        
        const prev = runningTotals[key] || { unit: 0, pkg: 0 };
        const prevGlobal = globalTotals[itemKey] || { unit: 0, pkg: 0 };
        
        let closingUnitVal = 0;
        let closingPkgVal = 0;

        if (t.source === "Stock Count" && (t.countedUnit !== undefined || t.countedPackage !== undefined)) {
            if (t.relatedParentItem) {
                // Bundle-derived count -> Additive (e.g. counting sets adds to pillowcases)
                const changeUnit = (t.countedUnit || 0);
                const changePkg = (t.countedPackage || 0);
                
                closingUnitVal = (prev.unit || 0) + changeUnit;
                closingPkgVal = (prev.pkg || 0) + changePkg;
            } else {
                // Main Count -> Reset (e.g. counting loose pillowcases resets balance)
                // CAUTION: This assumes Main Count is entered BEFORE Bundle Counts on the same day, 
                // or acts as the "Base". If entered after, it wipes Bundle counts.
                closingUnitVal = t.countedUnit || 0;
                closingPkgVal = t.countedPackage || 0;
            }
        } else {
            // Calculate change from deltas
            const changeUnit = (t.purchasedUnit || 0) + (t.soakUnit || 0) - (t.consumedUnit || 0);
            const changePkg = (t.purchasedPackage || 0) + (t.soakPackage || 0) - (t.consumedPackage || 0);
            
            closingUnitVal = (prev.unit || 0) + changeUnit;
            closingPkgVal = (prev.pkg || 0) + changePkg;
        }

        // Calculate effective change to apply to global totals
        const diffUnit = closingUnitVal - (prev.unit || 0);
        const diffPkg = closingPkgVal - (prev.pkg || 0);
        
        const globalUnit = (prevGlobal.unit || 0) + diffUnit;
        const globalPkg = (prevGlobal.pkg || 0) + diffPkg;
        
        map.set(t._id, { 
            opening: prev.unit, 
            closing: closingUnitVal, 
            openingPkg: prev.pkg, 
            closingPkg: closingPkgVal,
            totalBalanceUnit: globalUnit,
            totalBalancePkg: globalPkg
        });
        
        runningTotals[key] = { unit: closingUnitVal, pkg: closingPkgVal };
        globalTotals[itemKey] = { unit: globalUnit, pkg: globalPkg };
    });

    return map;
  }, [transactions]);

  // Filter
  const filteredTransactions = transactions.filter(t => {
      const itemName = items[t.item]?.item || "Unknown Item"; // Access .item property
      const locName = locations[t.location] || "Unknown Location";
      const query = searchQuery.toLowerCase();
      
      const matchesQuery = itemName.toLowerCase().includes(query) || locName.toLowerCase().includes(query);
      
      const matchesLocation = filterLocation === "ALL" || t.location === filterLocation;
      
      let matchesDate = true;
      if (dateRange.start && t.date < dateRange.start) matchesDate = false;
      if (dateRange.end && t.date > dateRange.end) matchesDate = false;

      return matchesQuery && matchesLocation && matchesDate;
  });

  const handleScroll = () => {
    if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50) { 
             setVisibleCount(prev => Math.min(prev + 20, filteredTransactions.length));
        }
    }
  };

  useEffect(() => {
      setVisibleCount(20);
      setSelectedIds(new Set()); 
  }, [searchQuery]);


  const displayedTransactions = filteredTransactions.slice(0, visibleCount);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header (Toolbar) */}
      <div className="flex-none min-h-[50px] border-b bg-white z-20">
        
        {/* Desktop Toolbar */}
        <div className="hidden md:flex items-center justify-between gap-4 px-4 py-3 h-full">
            {headerContent && (
                <div className="flex items-center gap-2 mr-2">
                    {headerContent}
                </div>
            )}
            
            {/* Left Actions - Mass Edit & Delete Selection */}
            <div className="flex items-center gap-2">
                 {/* Mass Edit Toggle */}
                 <div className="flex items-center gap-1">
                     {isMassEditMode ? (
                        <>
                            <Button variant="outline" size="icon" onClick={toggleMassEdit} disabled={saveLoading} className="h-8 w-8 text-red-600 border-red-200 bg-red-50">
                                <X className="h-4 w-4" />
                            </Button>
                            <Button size="icon" onClick={saveMassEdit} disabled={saveLoading} className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white">
                                {saveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                        </>
                     ) : (
                        <Button variant="ghost" size="icon" onClick={toggleMassEdit} className="h-8 w-8" title="Quick Edit">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                     )}
                 </div>

                 {selectedIds.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                        Delete ({selectedIds.size})
                    </Button>
                )}
            </div>

            {/* Right Filters */}
            <div className="flex flex-1 justify-end gap-2 items-center">
                
                {/* Location Filter */}
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                    <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Locations</SelectItem>
                        {Object.entries(locations).map(([id, name]) => (
                            <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Date Filter */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 border-dashed">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            {dateRange.start ? (
                                <>
                                    {dateRange.start} {dateRange.end ? ` - ${dateRange.end}` : ""}
                                </>
                            ) : "Date Range"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="end">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Filter by Date</h4>
                                <p className="text-sm text-muted-foreground">Select date range for transactions.</p>
                            </div>
                            <div className="grid gap-2">
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="start">Start</Label>
                                    <Input id="start" type="date" className="col-span-2 h-8" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="end">End</Label>
                                    <Input id="end" type="date" className="col-span-2 h-8" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
                                </div>
                                {(dateRange.start || dateRange.end) && (
                                    <Button variant="ghost" size="sm" onClick={() => setDateRange({ start: "", end: "" })} className="w-full">
                                        Clear Filter
                                    </Button>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Search Bar */}
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="w-full bg-background pl-8 h-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex flex-col gap-3 p-3">
             {/* Row 1: Search & Quick Edit */}
            <div className="flex items-center justify-between gap-2">
                 {/* No breadcrumbs here, assume context is clear or handled by parent */}
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative w-full">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search..."
                            className="w-full bg-background pl-7 h-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Mobile Quick Edit Toggle */}
                    {isMassEditMode ? (
                        <>
                            <Button variant="ghost" size="icon" onClick={toggleMassEdit} className="h-8 w-8 text-red-600 shrink-0">
                                <X className="h-4 w-4" />
                            </Button>
                            <Button size="icon" onClick={saveMassEdit} className="h-8 w-8 bg-green-600 text-white shrink-0">
                                {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={toggleMassEdit} className="h-8 w-8 shrink-0">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Row 2: Filters & Actions */}
            <div className="flex items-center gap-2">
                 {selectedIds.size > 0 && (
                    <Button variant="destructive" size="icon" className="h-9 w-9 shrink-0" onClick={handleDeleteSelected}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                
                {/* Location Icon Selector */}
                <div className="flex-1">
                     <Select value={filterLocation} onValueChange={setFilterLocation}>
                        <SelectTrigger className="w-full h-9 text-xs">
                             <Filter className="h-3 w-3 mr-2" />
                            <SelectValue placeholder="Loc" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Locations</SelectItem>
                            {Object.entries(locations).map(([id, name]) => (
                                <SelectItem key={id} value={id}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                 {/* Date Icon Range */}
                 <div className="flex-1">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-9 justify-start text-left font-normal px-2 text-xs">
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {dateRange.start ? (
                                    <span className="truncate">
                                        {dateRange.start}
                                        {dateRange.end ? `:${dateRange.end.slice(5)}` : ""}
                                    </span>
                                ) : <span>Date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="start">
                             <div className="grid gap-2">
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="m-start">Start</Label>
                                    <Input id="m-start" type="date" className="col-span-2 h-8" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="m-end">End</Label>
                                    <Input id="m-end" type="date" className="col-span-2 h-8" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
                                </div>
                                {(dateRange.start || dateRange.end) && (
                                    <Button variant="ghost" size="sm" onClick={() => setDateRange({ start: "", end: "" })} className="w-full">
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                 </div>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
          <div 
            className="flex-1 overflow-auto bg-white" 
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >

            <div className="md:hidden p-2 space-y-2">
                {displayedTransactions.map(t => {
                  const overrides = massEditedTransactions[t._id] || {};
                  const currentT = { ...t, ...overrides };
                  const calculated = balanceMap.get(t._id);
                  
                  // Calculate Opening Balance (Units & Packages)
                  const openingUnit = calculated ? calculated.opening : ((t.countedUnit || 0) - (t.purchasedUnit || 0) - (t.soakUnit || 0) + (t.consumedUnit || 0));
                  const openingPackage = calculated ? calculated.openingPkg : ((t.countedPackage || 0) - (t.purchasedPackage || 0) - (t.soakPackage || 0) + (t.consumedPackage || 0));

                  const closingUnit = calculated ? calculated.closing : (currentT.countedUnit || 0);
                  const closingPackage = calculated ? calculated.closingPkg : (currentT.countedPackage || 0);
                  
                  const purchSoakUnit = (currentT.purchasedUnit || 0) + (currentT.soakUnit || 0);
                  const purchSoakPackage = (currentT.purchasedPackage || 0) + (currentT.soakPackage || 0);
                  
                      const renderStockValue = (pkg: number = 0, unit: number = 0, isEdit: boolean, fieldPkg: keyof Transaction, fieldUnit: keyof Transaction, id: string) => {
                          const itemDef = items[t.item];
                          const hasPackage = !!itemDef?.package && itemDef.package !== "0";

                          if (isEdit && fieldPkg && fieldUnit) {
                              return (
                                  <div className="flex flex-col gap-1 items-center">
                                       {hasPackage && (
                                           <div className="relative">
                                              <Box className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-50" />
                                              <Input 
                                                className="h-6 w-16 pl-5 text-center text-[10px]" 
                                                placeholder="P"
                                                value={currentT[fieldPkg] as number ?? 0}
                                                onChange={(e) => handleMassEditChange(id, fieldPkg, parseInt(e.target.value)||0)}
                                            />
                                           </div>
                                       )}
                                       <div className="relative">
                                          <Circle className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-50" />
                                          <Input 
                                            className="h-6 w-16 pl-5 text-center text-[10px]" 
                                            placeholder="U"
                                            value={currentT[fieldUnit] as number ?? 0}
                                            onChange={(e) => handleMassEditChange(id, fieldUnit, parseInt(e.target.value)||0)}
                                        />
                                       </div>
                                  </div>
                              );
                          }
                          return (
                              <div className="flex flex-col items-center justify-center gap-0.5 text-[10px]">
                                   {hasPackage && (
                                       <div className="flex items-center gap-1">
                                           <Box className="h-3 w-3 text-gray-400" />
                                           <span className="font-mono font-medium">{pkg}</span>
                                       </div>
                                   )}
                                   {hasPackage && <div className="w-8 h-[1px] bg-gray-100" />}
                                    <div className="flex items-center gap-1">
                                       {hasPackage && <Circle className="h-3 w-3 text-gray-300" />}
                                       <span className="font-mono text-gray-600">{unit}</span>
                                   </div>
                              </div>
                          );
                      };

                  return (
                     <div key={t._id} className="bg-white border rounded-lg p-3 shadow-sm text-xs relative">
                         {/* Edit/Delete Actions */}
                         {!isMassEditMode && (
                             <div className="absolute top-3 right-3 flex gap-2">
                                 <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditClick(t)}>
                                     <Pencil className="h-3 w-3" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => handleDeleteClick(t._id)}>
                                     <Trash2 className="h-3 w-3" />
                                 </Button>
                             </div>
                         )}
                         
                         <div className="pr-16 mb-2">
                             <div className="flex items-center gap-2 mb-1">
                                <TransactionIcon t={currentT} />
                                {!itemId && (
                                    <div className="font-semibold text-sm">
                                        <Link href={`/admin/items/${t.item}`} className="hover:underline text-blue-600 hover:text-blue-800">
                                            {items[t.item]?.item || t.item}
                                        </Link>
                                    </div>
                                )}
                             </div>
                             <div className="text-muted-foreground flex items-center gap-1">
                                 {isMassEditMode ? (
                                     <Input 
                                        type="date" 
                                        className="h-6 w-32 text-xs"
                                        value={currentT.date ? format(new Date(currentT.date), "yyyy-MM-dd") : ""}
                                        onChange={(e) => handleMassEditChange(t._id, "date", e.target.value)}
                                     /> 
                                 ) : (
                                    <>
                                        {format(new Date(t.date), "MMM d, yyyy")} • {locations[t.location] || t.location}
                                    </>
                                 )}
                             </div>
                         </div>
                         
                         <div className="grid grid-cols-3 gap-1 text-center bg-gray-50 rounded p-2">
                             
                             <div className="text-blue-600 flex flex-col items-center">
                                 <div className="text-[10px] text-blue-400 mb-1">P/S</div>
                                 {renderStockValue(purchSoakPackage, purchSoakUnit, isMassEditMode, "purchasedPackage", "purchasedUnit", t._id)}
                             </div>
                             
                             <div className="text-red-600 flex flex-col items-center">
                                 <div className="text-[10px] text-red-400 mb-1">C/D</div>
                                 {renderStockValue(currentT.consumedPackage, currentT.consumedUnit, isMassEditMode, "consumedPackage", "consumedUnit", t._id)}
                             </div>
                             
                             <div className="font-bold flex flex-col items-center">
                                 <div className="text-[10px] text-gray-500 mb-1">Close</div>
                                 {renderStockValue(isMassEditMode ? currentT.countedPackage : closingPackage, isMassEditMode ? currentT.countedUnit : closingUnit, isMassEditMode, "countedPackage", "countedUnit", t._id)}
                             </div>
                         </div>
                     </div>
                  );
                })}
            </div>

            <Table className="hidden md:table">
                <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                    <TableRow className="bg-gray-50/50 border-b">
                        <TableHead className="w-[40px] pl-4">
                            <input type="checkbox" 
                                className="rounded border-gray-300"
                                checked={displayedTransactions.length > 0 && selectedIds.size === displayedTransactions.length}
                                onChange={toggleAll}
                            />
                        </TableHead>
                        <TableHead className="w-[100px] pl-4">Type</TableHead>
                        <TableHead className="w-[100px] pl-4">Date</TableHead>
                        <TableHead className="w-[150px]">Location</TableHead>
                        {!itemId && <TableHead className="w-[150px]">Item</TableHead>}
                        <TableHead className="text-center bg-gray-100/50">Opening</TableHead>
                        <TableHead className="text-center">Counted</TableHead>
                        <TableHead className="text-center text-blue-600">Purchased</TableHead>
                        <TableHead className="text-center text-cyan-600">Soak</TableHead>
                        <TableHead className="text-center text-red-600">Cons/Disp</TableHead>
                        <TableHead className="text-center font-bold bg-gray-100/50">Closing</TableHead>
                        <TableHead className="text-center font-bold text-green-700 bg-green-50/50">Balance</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                         <TableRow>
                            <TableCell colSpan={12} className="h-24 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : displayedTransactions.length === 0 ? (
                        <TableRow>
                             <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                                No transactions found.
                             </TableCell>
                        </TableRow>
                    ) : (
                        <>
                            {displayedTransactions.map((t) => {
                                const overrides = massEditedTransactions[t._id] || {};
                                const currentT = { ...t, ...overrides };
                                const calculated = balanceMap.get(t._id);
                                
                                const openingUnit = calculated ? calculated.opening : ((t.countedUnit || 0) - (t.purchasedUnit || 0) - (t.soakUnit || 0) + (t.consumedUnit || 0));
                                const openingPackage = calculated ? calculated.openingPkg : ((t.countedPackage || 0) - (t.purchasedPackage || 0) - (t.soakPackage || 0) + (t.consumedPackage || 0));

                                const closingUnit = calculated ? calculated.closing : (currentT.countedUnit || 0);
                                const closingPackage = calculated ? calculated.closingPkg : (currentT.countedPackage || 0);
                                
                                const totalBalanceUnit = calculated ? calculated.totalBalanceUnit : (currentT.countedUnit || 0);
                                const totalBalancePackage = calculated ? calculated.totalBalancePkg : (currentT.countedPackage || 0);

                                const purchSoakUnit = (currentT.purchasedUnit || 0) + (currentT.soakUnit || 0);
                                const purchSoakPackage = (currentT.purchasedPackage || 0) + (currentT.soakPackage || 0);

                                const getPackageSize = (itemId: string): number => {
                                    const item = items[itemId];
                                    if (!item?.package) return 1;
                                    const match = item.package.match(/(\d+)/);
                                    return match ? parseInt(match[0], 10) : 1;
                                };

                                const calculateTotalCount = (pkg: number, unit: number, itemId: string) => {
                                    const size = getPackageSize(itemId);
                                    return (pkg * size) + unit;
                                };

                                const CellDisplay = ({ pkg, unit, itemId, fieldPkg, fieldUnit, isEdit, showTotalOnly = false, isStockDisplay = false }: { 
                                    pkg?: number; 
                                    unit?: number; 
                                    itemId: string;
                                    fieldPkg?: keyof Transaction; 
                                    fieldUnit?: keyof Transaction; 
                                    isEdit?: boolean;
                                    showTotalOnly?: boolean;
                                    isStockDisplay?: boolean;
                                }) => {
                                    const itemDef = items[itemId];
                                    const hasPackage = !!itemDef?.package && itemDef.package !== "0";
                                    const totalCount = calculateTotalCount(pkg || 0, unit || 0, itemId);

                                    if (isEdit && fieldPkg && fieldUnit) {
                                         return (
                                            <div className="flex gap-2 items-center justify-center">
                                                {hasPackage && (
                                                    <div className="relative">
                                                        <Box className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-50" />
                                                        <Input 
                                                            className="h-6 w-12 pl-4 text-center text-[10px]" 
                                                            placeholder="P"
                                                            value={currentT[fieldPkg] as number ?? 0}
                                                            onChange={(e) => handleMassEditChange(t._id, fieldPkg, parseInt(e.target.value)||0)}
                                                        />
                                                    </div>
                                                )}
                                                <div className="relative">
                                                     <Circle className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-50" />
                                                     <Input 
                                                       className="h-6 w-12 pl-4 text-center text-[10px]" 
                                                       placeholder="U"
                                                       value={currentT[fieldUnit] as number ?? 0}
                                                       onChange={(e) => handleMassEditChange(t._id, fieldUnit, parseInt(e.target.value)||0)}
                                                     />
                                                </div>
                                            </div>
                                         );
                                    }

                                    if (showTotalOnly) {
                                        return <span className="font-bold">{totalCount}</span>;
                                    }

                                    if (isStockDisplay) {
                                         // opening/counted/etc format: 1 / 20 (70)
                                         // Normalize display to be greedy with packages
                                         let dispPkg = pkg || 0;
                                         let dispUnit = unit || 0;

                                         if (hasPackage) {
                                             const size = getPackageSize(itemId);
                                             if (size > 1) {
                                                 dispPkg = Math.floor(totalCount / size);
                                                 dispUnit = totalCount % size;
                                             }
                                         }
                                         
                                         return (
                                            <div className="flex flex-col items-center text-[10px]">
                                                <div className="flex items-center gap-1">
                                                    {hasPackage && (
                                                        <>
                                                            <span className="font-mono">{dispPkg}</span>
                                                            <span className="text-muted-foreground">/</span>
                                                        </>
                                                    )}
                                                    <span className="font-mono">{dispUnit}</span>
                                                </div>
                                                {hasPackage && (
                                                    <div className="text-muted-foreground font-semibold">
                                                        ({totalCount})
                                                    </div>
                                                )}
                                            </div>
                                         );
                                    }

                                    return (
                                        <div className="flex flex-col items-center justify-center gap-0.5 text-[10px]">
                                             {hasPackage && (
                                                 <div className="flex items-center gap-1">
                                                     <Box className="h-3 w-3 text-gray-400" />
                                                     <span className="font-mono font-medium">{pkg || 0}</span>
                                                 </div>
                                             )}
                                             <div className="flex items-center gap-1">
                                                 {hasPackage && <Circle className="h-3 w-3 text-gray-300" />}
                                                 <span className="font-mono text-gray-600">{unit || 0}</span>
                                             </div>
                                        </div>
                                    );
                                };

                                return (
                                <TableRow key={t._id} className="hover:bg-muted/50 border-b">
                                    <TableCell className="pl-4">
                                        <input type="checkbox" 
                                            className="rounded border-gray-300"
                                            checked={selectedIds.has(t._id)}
                                            onChange={() => toggleSelection(t._id)}
                                            disabled={isMassEditMode}
                                        />
                                    </TableCell>
                                    <TableCell className="pl-4 font-medium text-xs whitespace-nowrap text-muted-foreground w-[100px]">
                                        <TransactionIcon t={currentT} />
                                    </TableCell>
                                    <TableCell className="pl-4 font-medium text-xs whitespace-nowrap">
                                        {isMassEditMode ? (
                                            <Input 
                                                type="date" 
                                                className="h-7 w-32 text-xs"
                                                value={currentT.date ? format(new Date(currentT.date), "yyyy-MM-dd") : ""}
                                                onChange={(e) => handleMassEditChange(t._id, "date", e.target.value)}
                                            />
                                        ) : format(new Date(t.date), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {locations[t.location] || t.location}
                                    </TableCell>
                                     {!itemId && (
                                         <TableCell className="text-xs font-medium text-gray-700">
                                            <div>
                                                <Link href={`/admin/items/${t.item}`} className="hover:underline text-blue-600 hover:text-blue-800">
                                                    {items[t.item]?.item || t.item}
                                                </Link>
                                                {t.relatedParentItem && (
                                                  <span className="block text-[10px] text-muted-foreground">
                                                    (via {items[t.relatedParentItem]?.item || "Parent Item"})
                                                  </span>
                                                )}
                                            </div>
                                        </TableCell>
                                     )}
                                    <TableCell className="text-center font-mono text-xs bg-gray-50/50 text-gray-600">
                                        <CellDisplay pkg={openingPackage} unit={openingUnit} itemId={t.item} isStockDisplay />
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs">
                                        {currentT.source === "Soak Cycle" || currentT.source === "Daily Occupancy" || currentT.source === "Stock Purchase" ? (
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            <CellDisplay pkg={currentT.countedPackage} unit={currentT.countedUnit} itemId={t.item} isEdit={isMassEditMode} fieldPkg="countedPackage" fieldUnit="countedUnit" isStockDisplay />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs text-blue-600">
                                        {currentT.source === "Stock Count" || currentT.source === "Soak Cycle" || currentT.source === "Daily Occupancy" ? (
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            <CellDisplay pkg={currentT.purchasedPackage} unit={currentT.purchasedUnit} itemId={t.item} isEdit={isMassEditMode} fieldPkg="purchasedPackage" fieldUnit="purchasedUnit" isStockDisplay />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs text-cyan-600">
                                        {currentT.source === "Stock Count" || currentT.source === "Daily Occupancy" || currentT.source === "Stock Purchase" ? (
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            <CellDisplay pkg={currentT.soakPackage} unit={currentT.soakUnit} itemId={t.item} isEdit={isMassEditMode} fieldPkg="soakPackage" fieldUnit="soakUnit" isStockDisplay />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs text-red-600">
                                        {currentT.source === "Stock Purchase" || (currentT.source === "Stock Count" && !currentT.consumedUnit && !currentT.consumedPackage) ? (
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            <CellDisplay pkg={currentT.consumedPackage} unit={currentT.consumedUnit} itemId={t.item} isEdit={isMassEditMode} fieldPkg="consumedPackage" fieldUnit="consumedUnit" isStockDisplay />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold bg-gray-50/50">
                                        <CellDisplay pkg={closingPackage} unit={closingUnit} itemId={t.item} isStockDisplay />
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-green-700 bg-green-50/50">
                                        <CellDisplay pkg={totalBalancePackage} unit={totalBalanceUnit} itemId={t.item} isStockDisplay />
                                    </TableCell>
                                    <TableCell>
                                        {!isMassEditMode && (
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditClick(t)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteClick(t._id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                      </TableCell>
                                  </TableRow>
                                  )})}
                            {/* Loading indicator */}
                            {visibleCount < filteredTransactions.length && (
                                <TableRow>
                                    <TableCell colSpan={12} className="text-center p-4">
                                        Loading more...
                                    </TableCell>
                                </TableRow>
                            )}
                        </>
                    )}
                </TableBody>
            </Table>
          </div>
      </div>

       {/* Edit Dialog (Single) */}
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Transaction</DialogTitle>
                <DialogDescription>
                    Update transaction details manually.
                </DialogDescription>
            </DialogHeader>
            {editingTransaction && (
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Date</Label>
                        <Input 
                            type="date" 
                            className="col-span-3"
                            value={editingTransaction.date ? format(new Date(editingTransaction.date), "yyyy-MM-dd") : ""}
                            onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                        />
                    </div>
                    {/* Add more fields as needed for single edit, or rely on Mass Edit */}
                    <div className="text-sm text-muted-foreground text-center col-span-4">
                        Use the "Mass Edit" mode for quick inline editing.
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={saveLoading}>
                    {saveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
       </Dialog>

       {/* Delete Confirmation Dialog */}
       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Delete</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete this transaction? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                </DialogFooter>
            </DialogContent>
       </Dialog>

    </div>
  );
}
