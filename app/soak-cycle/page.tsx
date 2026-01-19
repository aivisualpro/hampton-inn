"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, Calendar, Save, ChevronRight, ChevronLeft, Search, Edit2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
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

const calculateTotal = (item: SoakCycleItem) => {
    return (item.previousBalance || 0) + (item.soakUnit || 0) - (item.disposedUnit || 0);
};

const sortItems = (a: SoakCycleItem, b: SoakCycleItem) => {
    // 1. Sort by Total (Descending)
    const totalA = calculateTotal(a);
    const totalB = calculateTotal(b);
    if (totalB !== totalA) {
        return totalB - totalA;
    }
    // 2. Sort by Item Name (Ascending)
    return a.item.localeCompare(b.item);
};

// LocalStorage keys
const STORAGE_KEYS = {
  LAST_DATE: "hampton_last_date",
};

// Helper to read from localStorage (instant, no async)
const readFromStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// Helper to write to localStorage
const writeToStorage = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("Failed to write to localStorage:", e);
  }
};

function SoakCycleContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<SoakCycleItem[]>([]);
  const [laundryLocationId, setLaundryLocationId] = useState<string | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get date from URL > LocalStorage > Default Today
  const getDateFromUrl = () => {
    const paramDate = searchParams.get("date");
    if (paramDate) return paramDate;
    
    // Check localStorage first for instant loading
    const cachedDate = readFromStorage(STORAGE_KEYS.LAST_DATE);
    if (cachedDate) return cachedDate;

    // Default to today in YYYY-MM-DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDate = getDateFromUrl();
  const searchQuery = searchParams.get("q") || "";

  // Helper to update URL and save preference
  const saveDatePreference = (dateStr: string) => {
    // Write to localStorage IMMEDIATELY
    writeToStorage(STORAGE_KEYS.LAST_DATE, dateStr);
    
    // Sync to server (async, non-blocking)
    fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastSelectedDate: dateStr })
    }).catch(e => console.error("Failed to save date preference", e));
  };

  // Helper to update URL
  const updateUrl = useCallback((key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
          params.set(key, value);
      } else {
          params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
      
      if (key === "date" && value) {
          saveDatePreference(value);
      }
  }, [searchParams, pathname, router]);

  const [dateInputValue, setDateInputValue] = useState(selectedDate);

  // Sync local state with URL state
  useEffect(() => {
    setDateInputValue(selectedDate);
  }, [selectedDate]);

  // Debounce URL update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dateInputValue !== selectedDate) {
        updateUrl("date", dateInputValue);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [dateInputValue, selectedDate, updateUrl]);  

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
        const locRes = await fetch("/api/locations", { cache: "no-store" });
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
        const itemsRes = await fetch("/api/items", { cache: "no-store" });
        if (!itemsRes.ok) throw new Error("Failed to fetch items");
        const allItems = await itemsRes.json();
        
        // 3. Filter items that belong to Laundry
        // Assuming laundry.items is an array of item IDs
        const laundryItemIds = laundry.items || [];
        const laundryItems = allItems.filter((item: any) => 
          laundryItemIds.includes(item._id)
        );
        
        // Check for saved user date preference if no date in URL
        const urlDate = searchParams.get("date");
        if (!urlDate) {
            try {
                const userRes = await fetch("/api/auth/me");
                if (userRes.ok) {
                    const user = await userRes.json();
                    if (user.lastSelectedDate) {
                        updateUrl("date", user.lastSelectedDate);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch user date preference", e);
            }
        }
        
        // Initialize state with these items (values 0 for now)
        const initializedItems = laundryItems.map((item: any) => ({
          ...item,
          previousBalance: 0,
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
    // Legacy function, replaced by loadValues in useEffect below
    // Kept for reference or removed if unused
  }, []); 

  // Trigger fetch when date or location changes, OR when items are first loaded
  useEffect(() => {
    if (laundryLocationId && items.length > 0) {
        // Helper to just fetch data and merge
        const loadValues = async () => {
            try {
             setLoading(true);
             const params = new URLSearchParams({
                date: selectedDate,
                location: laundryLocationId,
              });
              
              // Single API call for opening balances and transactions
              const response = await fetch(`/api/stock/combined?${params}`, { cache: "no-store" });
              const data = await response.json();

              const openingBalances = data.openingBalances || {};
              const transactions = data.transactions || {};
              
              setItems(currentItems => currentItems.map(item => {
                // Find previous balance from map
                const previousBalance = openingBalances[item._id]?.unit || 0;

                // Find current transaction values from map
                const trans = transactions[item._id];
                const soakUnit = trans?.soakUnit || 0;
                const disposedUnit = trans?.consumedUnit || 0;
                
                // Only update if changed to avoid unnecessary re-renders
                if (item.previousBalance === previousBalance && item.soakUnit === soakUnit && item.disposedUnit === disposedUnit) {
                    return item;
                }

                return {
                    ...item,
                    previousBalance,
                    soakUnit,
                    disposedUnit,
                };
              }).sort(sortItems));
            } catch(e) { 
                console.error(e); 
            } finally {
                setLoading(false);
            }
        };
        loadValues();
    }
  }, [selectedDate, laundryLocationId, items.length]);


  const handleValueChange = (id: string, field: keyof SoakCycleItem, value: string) => {
    const numValue = parseInt(value) || 0;
    setItems(prev => prev.map(item => 
      item._id === id ? { ...item, [field]: numValue } : item
    ));
  };

  const handleSave = async () => {
    if (!laundryLocationId) return;
    
    // Optimistic Update
    setIsEditing(false);
    setItems(prev => [...prev].sort(sortItems)); 
    toast({ title: "Updates applied", description: "Syncing..." });

    setSaving(true);
    try {
      // Filter items: Don't add transaction if Soak, Disposed, and Total are all 0
      const itemsToSave = items.filter(item => {
        const total = calculateTotal(item);
        const hasValue = item.soakUnit !== 0 || item.disposedUnit !== 0 || total !== 0;
        return hasValue;
      });

      const promises = itemsToSave.map(item => {
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
      
      toast({ title: "Success", description: "Saved successfully." });
    } catch (error) {
      console.error("Error saving data:", error);
      toast({ variant: "destructive", title: "Save Failed", description: "Please try again." });
      setIsEditing(true); // Re-enable edit mode on failure
    } finally {
      setSaving(false);
    }
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
    <div className="w-full h-full flex flex-col">
      {/* Top Controls */}
      <div className="border-b bg-white px-4 py-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Soak Cycle</span>
        </div>

        {/* Mobile: Stacked rows */}
        <div className="md:hidden space-y-3">
          {/* Row 1: Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="w-full pl-8 h-10"
                value={searchQuery}
                onChange={(e) => updateUrl("q", e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Date & Update Button */}
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => {
              const currentDate = new Date(selectedDate);
              currentDate.setDate(currentDate.getDate() - 1);
              updateUrl("date", currentDate.toISOString().split('T')[0]);
            }} disabled={isEditing}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateInputValue}
                onChange={(e) => setDateInputValue(e.target.value)}
                className="w-[130px] pl-8 h-10 text-xs"
                disabled={isEditing}
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => {
              const currentDate = new Date(selectedDate);
              currentDate.setDate(currentDate.getDate() + 1);
              updateUrl("date", currentDate.toISOString().split('T')[0]);
            }} disabled={isEditing}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} size="icon" className="h-10 w-10 shrink-0" disabled={loading}>
                <Edit2 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setIsEditing(false)} disabled={saving}>
                  <X className="h-4 w-4" />
                </Button>
                <Button size="icon" className="h-10 w-10" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Single row */}
        <div className="hidden md:flex gap-3 items-center">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search items..."
              className="w-full pl-8 h-9"
              value={searchQuery}
              onChange={(e) => updateUrl("q", e.target.value)}
            />
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => {
              const currentDate = new Date(selectedDate);
              currentDate.setDate(currentDate.getDate() - 1);
              updateUrl("date", currentDate.toISOString().split('T')[0]);
            }} disabled={isEditing}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateInputValue}
                onChange={(e) => setDateInputValue(e.target.value)}
                className="w-[140px] pl-9 h-9"
                disabled={isEditing}
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => {
              const currentDate = new Date(selectedDate);
              currentDate.setDate(currentDate.getDate() + 1);
              updateUrl("date", currentDate.toISOString().split('T')[0]);
            }} disabled={isEditing}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Action Buttons */}
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} size="sm" disabled={loading}>
              <Edit2 className="h-4 w-4 mr-2" />
              Update Records
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Items List - Card View for Mobile, Table for Desktop */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-yellow-50 rounded-lg"></div>
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-green-50 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-lg font-medium">No Items</p>
            <p className="text-sm">{searchQuery ? "No items match your search." : "No items found in Laundry."}</p>
          </div>
        ) : (
          <>
            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paginatedItems.map((item) => (
                <div key={item._id} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                  {/* Item Name */}
                  <div className="flex items-center justify-between">
                    <Link href={`/admin/items/${item._id}`} className="font-semibold text-gray-900 hover:text-primary hover:underline text-lg">
                      {item.item}
                    </Link>
                  </div>
                  
                  {/* Values Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Opening Balance */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Opening Balance</p>
                      <p className="text-lg font-bold text-gray-700">{item.previousBalance}</p>
                    </div>
                    
                    {/* Soak Cycle - Editable */}
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-xs text-yellow-600 mb-1">Soak Cycle</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          value={item.soakUnit}
                          onChange={(e) => handleValueChange(item._id, "soakUnit", e.target.value)}
                          className="h-10 text-lg font-bold text-center border-yellow-200 focus-visible:ring-yellow-400"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <p className="text-lg font-bold text-yellow-700">{item.soakUnit}</p>
                      )}
                    </div>
                    
                    {/* Disposed - Editable */}
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-600 mb-1">Disposed</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          value={item.disposedUnit}
                          onChange={(e) => handleValueChange(item._id, "disposedUnit", e.target.value)}
                          className="h-10 text-lg font-bold text-center border-red-200 focus-visible:ring-red-400"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <p className="text-lg font-bold text-red-700">{item.disposedUnit}</p>
                      )}
                    </div>
                    
                    {/* Closing Balance */}
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-1">Closing Balance</p>
                      <p className="text-lg font-bold text-green-700">{calculateTotal(item)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg border shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="font-semibold pl-4">Item</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-gray-50/50">Opening</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-yellow-50/50">Soak Cycle</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-red-50/50">Disposed</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-green-50/50">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium pl-4">
                        <Link href={`/admin/items/${item._id}`} className="hover:underline hover:text-primary">
                          {item.item}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-600 bg-gray-50/30">
                        {item.previousBalance}
                      </TableCell>
                      <TableCell className="text-center bg-yellow-50/20">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={item.soakUnit}
                            onChange={(e) => handleValueChange(item._id, "soakUnit", e.target.value)}
                            className="w-20 mx-auto text-center h-8 border-yellow-200 focus-visible:ring-yellow-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <span>{item.soakUnit}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center bg-red-50/20">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={item.disposedUnit}
                            onChange={(e) => handleValueChange(item._id, "disposedUnit", e.target.value)}
                            className="w-20 mx-auto text-center h-8 border-red-200 focus-visible:ring-red-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <span>{item.disposedUnit}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-green-700 bg-green-50/20">
                        {calculateTotal(item)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
      
      {/* Pagination Controls */}
      {!loading && filteredItems.length > 0 && (
        <div className="flex-none flex items-center justify-between p-3 border-t bg-white">
          <div className="text-xs text-muted-foreground">
            {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SoakCyclePage() {
  return (
    <Suspense fallback={
       <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
       </div>
    }>
      <SoakCycleContent />
    </Suspense>
  );
}
