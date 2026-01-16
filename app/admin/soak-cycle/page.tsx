"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Calendar, Save, ChevronRight, ChevronLeft, Search } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";

type Item = {
  _id: string;
  item: string;
};

type Transaction = {
  item: string;
  countedUnit: number;
  soakUnit: number;
  consumedUnit: number; // Disposed
};

type SoakCycleItem = Item & {
  previousBalance: number; // Opening balance from previous date
  soakUnit: number;
  disposedUnit: number;
};

export default function SoakCyclePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SoakCycleItem[]>([]);
  const [laundryLocationId, setLaundryLocationId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  // Pagination & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter & Paginate
  const filteredItems = items.filter((item) => 
    item.item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
  // Fetch Laundry Location and its Items
  useEffect(() => {
    const fetchLaundryData = async () => {
      try {
        setLoading(true);
        // 1. Fetch all locations to find "Laundry"
        const locRes = await fetch("/api/locations");
        if (!locRes.ok) throw new Error("Failed to fetch locations");
        const locations = await locRes.json();
        
        const laundry = locations.find((l: any) => l.name.toLowerCase() === "laundry");
        
        if (!laundry) {
          console.error("Laundry location not found");
          setLoading(false);
          return;
        }
        
        setLaundryLocationId(laundry._id);

        // 2. Fetch all Items (for names)
        const itemsRes = await fetch("/api/items");
        if (!itemsRes.ok) throw new Error("Failed to fetch items");
        const allItems = await itemsRes.json();
        
        // 3. Filter items that belong to Laundry
        // Assuming laundry.items is an array of item IDs
        const laundryItemIds = laundry.items || [];
        const laundryItems = allItems.filter((item: any) => 
          laundryItemIds.includes(item._id)
        );
        
        // Initialize state with these items (values 0 for now)
        const initializedItems = laundryItems.map((item: any) => ({
          ...item,
          countedUnit: 0,
          soakUnit: 0,
          disposedUnit: 0,
        }));
        
        setItems(initializedItems);
        
      } catch (error) {
        console.error("Error initializing soak cycle page:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLaundryData();
  }, []);

  // Fetch Transactions for selected date and merge with items
  const fetchTransactions = useCallback(async () => {
    if (!laundryLocationId || !items.length) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        date: selectedDate,
        location: laundryLocationId,
      });
      
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const transactions: Transaction[] = await res.json();
      
      // Update items with transaction data
      setItems(prevItems => prevItems.map(item => {
        const trans = transactions.find(t => t.item === item._id);
        return {
          ...item,
          countedUnit: trans?.countedUnit || 0,
          soakUnit: trans?.soakUnit || 0,
          disposedUnit: trans?.consumedUnit || 0,
        };
      }));
      
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [laundryLocationId, selectedDate, items.length]); // Added items.length to dependency to ensure we have items first

  // Trigger fetch when date or location changes, but only if items are already loaded (initially)
  useEffect(() => {
    if (laundryLocationId && items.length > 0) {
        // We need a separate fetching logic that doesn't depend on items to avoid infinite loop if we were setting items there
        // But here we are just updating values. 
        // Actually best pattern: Separate "Config" (Items) from "Data" (Transactions).
        // For simplicity, I'm merging them in state.
        
        // Helper to just fetch data and merge
        const loadValues = async () => {
            try {
             setLoading(true);
             const params = new URLSearchParams({
                date: selectedDate,
                location: laundryLocationId,
              });
              
              // Parallel fetch: Previous Balances + Current Transactions
              const [openingRes, currentRes] = await Promise.all([
                  fetch(`/api/stock/opening-balance?${params}`),
                  fetch(`/api/transactions?${params}`)
              ]);

              const openingBalances = await openingRes.json();
              const transactions = await currentRes.json();
              
              setItems(currentItems => currentItems.map(item => {
                // Find previous balance
                const prevRecord = openingBalances.find((b: any) => b.item === item._id);
                const previousBalance = prevRecord?.openingBalance || 0;

                // Find current transaction values
                const trans = transactions.find((t: any) => t.item === item._id);
                
                return {
                    ...item,
                    previousBalance: previousBalance,
                    soakUnit: trans?.soakUnit || 0,
                    disposedUnit: trans?.consumedUnit || 0,
                    // Note: We don't need to load 'countedUnit' (Total) for display state, 
                    // as it is derived from (Prev + Soak - Disposed).
                    // However, we could check if it matches for integrity.
                };
              }));
            } catch(e) { 
                console.error(e); 
            } finally {
                setLoading(false);
            }
        };
        loadValues();
    }
  }, [selectedDate, laundryLocationId]); // Removed items dependency to avoid loops, only re-fetch values on date/loc change


  const handleValueChange = (id: string, field: keyof SoakCycleItem, value: string) => {
    const numValue = parseInt(value) || 0;
    setItems(prev => prev.map(item => 
      item._id === id ? { ...item, [field]: numValue } : item
    ));
  };

  const handleSave = async () => {
    if (!laundryLocationId) return;
    setSaving(true);
    try {
      const promises = items.map(item => {
        return fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            location: laundryLocationId,
            item: item._id,
            countedUnit: calculateTotal(item), // calculated Total becomes the new Counted Unit record
            soakUnit: item.soakUnit,
            consumedUnit: item.disposedUnit, // Map disposed to consumed
          }),
        });
      });
      
      await Promise.all(promises);
      // Optional: Show success toast
    } catch (error) {
      console.error("Error saving data:", error);
    } finally {
      setSaving(false);
    }
  };

  // Helper to calculate total
  const calculateTotal = (item: SoakCycleItem) => {
    // Formula: Units Available (Previous Balance) + Soak Cycle - Disposed
    // Note: Implicitly, 'Units Available' meant 'Clean on Shelf'.
    // If Soak is ADDITIVE (coming back clean), then + Soak.
    // If Disposed is SUBTRACTIVE (thrown away), then - Disposed.
    return (item.previousBalance || 0) + (item.soakUnit || 0) - (item.disposedUnit || 0);
  };

  if (!laundryLocationId && !loading) {
     return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-red-600">Configuration Error</h2>
            <p className="text-muted-foreground">"Laundry" location not found. Please create a location named "Laundry" in Settings.</p>
        </div>
     )
  }

  return (

    <div className="h-full flex flex-col overflow-hidden">
       {/* Header */}
      <div className="flex-none h-[6%] min-h-[50px] border-b flex items-center justify-between gap-4 px-4 bg-white z-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          <Link href="/admin" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Soak Cycle</span>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-sm w-full md:w-64">
             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               type="search"
               placeholder="Search items..."
               className="w-full bg-background pl-8 h-8 text-sm"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
        </div>
        
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto h-8"
              />
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving || loading}>
                {saving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                    </>
                )}
            </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
          <div className="flex-1 overflow-auto bg-white">
                <Table>
                    <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                        <TableRow className="hover:bg-muted/50 border-b">
                            <TableHead className="w-[30%] bg-white pl-4">Items</TableHead>
                            <TableHead className="text-center bg-gray-100/50">Units Available</TableHead>
                            <TableHead className="text-center bg-yellow-100/50">Soak Cycle</TableHead>
                            <TableHead className="text-center bg-white">Disposed</TableHead>
                            <TableHead className="text-center font-bold bg-white">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : paginatedItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    {(searchQuery ? "No items match your search." : "No items found in Laundry.")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedItems.map((item) => (
                                <TableRow key={item._id} className="hover:bg-muted/50 border-b group">
                                    <TableCell className="font-medium pl-4">{item.item}</TableCell>
                                    <TableCell className="text-center p-1 bg-gray-50/30">
                                        <div className="w-20 mx-auto text-center h-8 flex items-center justify-center font-medium text-gray-700">
                                            {item.previousBalance}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center p-1 bg-yellow-50/30">
                                        <Input
                                            type="number"
                                            className="w-20 mx-auto text-center h-8 bg-yellow-100/50 border-yellow-200 focus-visible:ring-yellow-400"
                                            value={item.soakUnit}
                                            onChange={(e) => handleValueChange(item._id, "soakUnit", e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center p-1">
                                        <Input
                                            type="number"
                                            className="w-20 mx-auto text-center h-8"
                                            value={item.disposedUnit}
                                            onChange={(e) => handleValueChange(item._id, "disposedUnit", e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-lg">
                                        {calculateTotal(item)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
           </div>
           
            {/* Pagination Controls */}
            {!loading && filteredItems.length > 0 && (
              <div className="flex-none flex items-center justify-end space-x-2 p-2 border-t bg-white z-20">
                <div className="flex-1 text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} entries
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="h-8"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
      </div>
    </div>
  );
}
