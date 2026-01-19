"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRef } from "react";
import { Loader2, ChevronRight, Search, Pencil, Trash2, MoreHorizontal, Calendar as CalendarIcon, Filter, X, Save } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  soakUnit: number;
  consumedUnit: number;
  purchasedUnit?: number;
  createdAt: string;
  relatedParentItem?: string;
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
          // Send parallel updates (since API might not support bulk)
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
    
    // We'll use the existing delete dialog logic if it was single,
    // but for multiple we'll just confirm via window or use a specific dialog.
    // Let's use window.confirm for speed as requested "quick".
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
      const [transRes, itemsRes, locRes, stockRes] = await Promise.all([
        fetch("/api/transactions"),
        fetch("/api/items"),
        fetch("/api/locations"),
        fetch("/api/stock/current"),
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
  }, []);

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
    
    // Close modal visually immediately
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

  // Filter
  const filteredTransactions = transactions.filter(t => {
      const itemName = items[t.item] || "Unknown Item";
      const locName = locations[t.location] || "Unknown Location";
      const query = searchQuery.toLowerCase();
      
      const matchesQuery = itemName.toLowerCase().includes(query) || locName.toLowerCase().includes(query);
      
      const matchesLocation = filterLocation === "ALL" || t.location === filterLocation;
      
      let matchesDate = true;
      if (dateRange.start && t.date < dateRange.start) matchesDate = false;
      if (dateRange.end && t.date > dateRange.end) matchesDate = false;

      return matchesQuery && matchesLocation && matchesDate;
  });

  // Infinite Scroll Handler
  const handleScroll = () => {
    if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50) { // Load more when near bottom
             setVisibleCount(prev => Math.min(prev + 20, filteredTransactions.length));
        }
    }
  };

  // Reset visible count on search
  useEffect(() => {
      setVisibleCount(20);
      setSelectedIds(new Set()); // Reset selection on search
  }, [searchQuery]);


  const displayedTransactions = filteredTransactions.slice(0, visibleCount);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none min-h-[50px] border-b bg-white z-20">
        
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between gap-4 px-4 py-3 h-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
            <Link href="/" className="hover:text-primary hover:underline">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">Transactions</span>
            </div>

            {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                    Delete ({selectedIds.size})
                </Button>
            )}

            {/* Mass Edit Actions Desktop */}
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
                    <Button variant="ghost" size="icon" onClick={toggleMassEdit} className="h-8 w-8">
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                 )}
            </div>

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
                        className="w-full bg-background pl-8 h-8 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex flex-col gap-3 p-3">
            {/* Row 1: Breadcrumbs & Search */}
            <div className="flex items-center justify-between gap-2">
                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Link href="/admin" className="hover:text-foreground">Admin</Link>
                    <ChevronRight className="h-3 w-3" />
                    <span className="font-medium text-foreground">Transactions</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-32">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search..."
                            className="w-full bg-background pl-7 h-8 text-xs"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Mobile Quick Edit Toggle */}
                    {isMassEditMode ? (
                        <>
                            <Button variant="ghost" size="icon" onClick={toggleMassEdit} className="h-8 w-8 text-red-600">
                                <X className="h-4 w-4" />
                            </Button>
                            <Button size="icon" onClick={saveMassEdit} className="h-8 w-8 bg-green-600 text-white">
                                {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={toggleMassEdit} className="h-8 w-8">
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
                     // Merge mass edit values
                     const overrides = massEditedTransactions[t._id] || {};
                     const currentT = { ...t, ...overrides };
                     
                     // Recalculate opening for display based on current values?
                     // Logic: Opening = Closing(Counted) - Purch - Soak + Consumed
                     // But strictly, Opening is fixed from prev day. 
                     // Let's just use original opening calculation for now or user edit consistency?
                     // Ideally we just show values. 
                     const opening = (t.countedUnit || 0) - (t.purchasedUnit || 0) - (t.soakUnit || 0) + (t.consumedUnit || 0); 
                     
                     return (
                        <div key={t._id} className="bg-white border rounded-lg p-3 shadow-sm text-xs relative">
                            {/* Selection Checkbox Mobile? Maybe skip for density, or add top right */}
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
                                <div className="font-semibold text-sm">{items[t.item] || t.item}</div>
                                <div className="text-muted-foreground">{format(new Date(t.date), "MMM d, yyyy")} • {locations[t.location] || t.location}</div>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-1 text-center bg-gray-50 rounded p-2">
                                <div>
                                    <div className="text-[10px] text-gray-500">Open</div>
                                    <div className="font-mono">{opening}</div>
                                </div>
                                <div className="text-blue-600">
                                    <div className="text-[10px] text-blue-400">P/S</div>
                                    {isMassEditMode ? (
                                        <div className="flex flex-col gap-1">
                                            <Input 
                                                className="h-6 text-[10px] px-1 text-center" 
                                                placeholder="P"
                                                value={currentT.purchasedUnit}
                                                onChange={(e) => handleMassEditChange(t._id, "purchasedUnit", parseInt(e.target.value)||0)}
                                            />
                                            <Input 
                                                className="h-6 text-[10px] px-1 text-center" 
                                                placeholder="S"
                                                value={currentT.soakUnit}
                                                onChange={(e) => handleMassEditChange(t._id, "soakUnit", parseInt(e.target.value)||0)}
                                            />
                                        </div>
                                    ) : (
                                        <div className="font-mono">{(currentT.purchasedUnit||0)+(currentT.soakUnit||0) || "-"}</div>
                                    )}
                                </div>
                                <div className="text-red-600">
                                    <div className="text-[10px] text-red-400">C/D</div>
                                    {isMassEditMode ? (
                                        <Input 
                                            className="h-6 text-[10px] px-1 text-center" 
                                            value={currentT.consumedUnit}
                                            onChange={(e) => handleMassEditChange(t._id, "consumedUnit", parseInt(e.target.value)||0)}
                                        />
                                    ) : (
                                        <div className="font-mono">{currentT.consumedUnit || "-"}</div>
                                    )}
                                </div>
                                <div className="font-bold">
                                    <div className="text-[10px] text-gray-500">Close</div>
                                    {isMassEditMode ? (
                                        <Input 
                                            className="h-6 text-[10px] px-1 text-center font-bold" 
                                            value={currentT.countedUnit}
                                            onChange={(e) => handleMassEditChange(t._id, "countedUnit", parseInt(e.target.value)||0)}
                                        />
                                    ) : (
                                        <div className="font-mono">{currentT.countedUnit}</div>
                                    )}
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
                        <TableHead className="w-[150px]">Item</TableHead>
                        <TableHead className="text-center bg-gray-100/50">Opening</TableHead>
                        <TableHead className="text-center">Counted</TableHead>
                        <TableHead className="text-center text-red-600">Cons/Disp</TableHead>
                        <TableHead className="text-center text-blue-600">Purch/Soak</TableHead>
                        <TableHead className="text-center font-bold bg-gray-100/50">Closing</TableHead>
                        <TableHead className="text-center font-bold text-green-700 bg-green-50/50">Total Balance</TableHead>
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
                                // Merge mass edit values
                                const overrides = massEditedTransactions[t._id] || {};
                                const currentT = { ...t, ...overrides };
                                
                                const opening = (t.countedUnit || 0) - (t.purchasedUnit || 0) - (t.soakUnit || 0) + (t.consumedUnit || 0);
                                const purchSoak = (currentT.purchasedUnit || 0) + (currentT.soakUnit || 0);

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
                                        {(() => {
                                            const types = [];
                                            if ((currentT.soakUnit || 0) > 0) types.push("Soak Cycle");
                                            if ((currentT.purchasedUnit || 0) > 0) types.push("Purchase");
                                            if ((currentT.consumedUnit || 0) > 0) types.push("Daily Occupancy");
                                            if (types.length === 0) types.push("Count");
                                            return types.join(", ");
                                        })()}
                                    </TableCell>
                                    <TableCell className="pl-4 font-medium text-xs whitespace-nowrap">
                                        {format(new Date(t.date), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {locations[t.location] || t.location}
                                    </TableCell>
                                    <TableCell className="text-xs font-medium text-gray-700">
                                        <div>
                                            {items[t.item] || t.item}
                                            {t.relatedParentItem && (
                                              <span className="block text-[10px] text-muted-foreground">
                                                (via {items[t.relatedParentItem] || "Parent Item"})
                                              </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs bg-gray-50/50 text-gray-600">
                                        {opening}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs">
                                        {isMassEditMode ? (
                                            <Input 
                                                className="h-7 w-16 mx-auto text-center" 
                                                value={currentT.countedUnit}
                                                onChange={(e) => handleMassEditChange(t._id, "countedUnit", parseInt(e.target.value)||0)}
                                            />
                                        ) : t.countedUnit}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs text-red-600">
                                         {isMassEditMode ? (
                                            <Input 
                                                className="h-7 w-16 mx-auto text-center" 
                                                value={currentT.consumedUnit}
                                                onChange={(e) => handleMassEditChange(t._id, "consumedUnit", parseInt(e.target.value)||0)}
                                            />
                                        ) : (t.consumedUnit > 0 ? t.consumedUnit : "-")}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs text-blue-600">
                                         {isMassEditMode ? (
                                             <div className="flex flex-col gap-1 items-center">
                                                <Input 
                                                    className="h-7 w-16 text-center placeholder:text-gray-300" 
                                                    placeholder="Buy"
                                                    title="Purchased"
                                                    value={currentT.purchasedUnit}
                                                    onChange={(e) => handleMassEditChange(t._id, "purchasedUnit", parseInt(e.target.value)||0)}
                                                />
                                                <Input 
                                                    className="h-7 w-16 text-center placeholder:text-gray-300" 
                                                    placeholder="Soak"
                                                    title="Soak"
                                                    value={currentT.soakUnit}
                                                    onChange={(e) => handleMassEditChange(t._id, "soakUnit", parseInt(e.target.value)||0)}
                                                />
                                             </div>
                                        ) : (purchSoak > 0 ? purchSoak : "-")}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold bg-gray-50/50">
                                        {currentT.countedUnit}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-green-700 bg-green-50/50">
                                        {totalStockMap[t.item]?.totalUnit || 0}
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
                              {/* Loading indicator for infinite scroll if needed, though strictly we just append rows */}
                              {visibleCount < filteredTransactions.length && (
                                  <TableRow>
                                      <TableCell colSpan={12} className="h-12 text-center text-xs text-muted-foreground">
                                          Scroll for more...
                                      </TableCell>
                                  </TableRow>
                              )}
                        </>
                      )}
                  </TableBody>
              </Table>
            </div>
            {/* Footer Status Bar */}
            <div className="flex-none h-[40px] border-t bg-gray-50 flex items-center justify-between px-4 text-xs text-muted-foreground">
                <div>
                   Showing <strong>{displayedTransactions.length}</strong> of <strong>{filteredTransactions.length}</strong> transactions
                </div>
                {displayedTransactions.length < filteredTransactions.length && (
                    <div className="animate-pulse">Scroll down to load more</div>
                )}
            </div>
        </div>
  
         <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the transaction and affect stock calculations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                <Label htmlFor="date" className="text-right">Date</Label>
                <Input
                    id="date"
                    type="date"
                    value={editingTransaction.date ? editingTransaction.date.split('T')[0] : ''}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                    className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Item</Label>
                <div className="col-span-3 font-medium text-sm text-muted-foreground">
                   {items[editingTransaction.item] || editingTransaction.item}
                </div>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Location</Label>
                <div className="col-span-3 font-medium text-sm text-muted-foreground">
                   {locations[editingTransaction.location] || editingTransaction.location}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="purchased" className="text-right">Purchase</Label>
                <Input 
                   id="purchased" 
                   type="number" 
                   value={editingTransaction.purchasedUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, purchasedUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3"
                   onWheel={(e) => (e.target as HTMLInputElement).blur()} 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="soak" className="text-right">Soak</Label>
                <Input 
                   id="soak" 
                   type="number" 
                   value={editingTransaction.soakUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, soakUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3"
                   onWheel={(e) => (e.target as HTMLInputElement).blur()} 
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="consumed" className="text-right">Consumed</Label>
                <Input 
                   id="consumed" 
                   type="number" 
                   value={editingTransaction.consumedUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, consumedUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3" 
                   onWheel={(e) => (e.target as HTMLInputElement).blur()}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="closing" className="text-right">Counted</Label>
                <Input 
                   id="closing" 
                   type="number" 
                   value={editingTransaction.countedUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, countedUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3 border-blue-200 bg-blue-50/50" 
                   onWheel={(e) => (e.target as HTMLInputElement).blur()}
                />
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
    </div>
  );
}
