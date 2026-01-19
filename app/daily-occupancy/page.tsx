
"use client";

import { useEffect, useState, useCallback, Suspense, Fragment } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, Calendar, Pencil, Save, ChevronRight, ChevronLeft, Search, Utensils } from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

type Item = {
  _id: string;
  item: string;
  subCategory?: string;
  package?: string;
  cookingQty?: string;
  isDailyCount?: boolean;
};

type ItemWithStats = Item & {
  openingBalanceUnit: number;
  consumedUnit: number; // Editable
  purchasedUnit: number; // Editable
};

type EditedValues = {
  [itemId: string]: {
    consumedUnit: number;
    purchasedUnit: number;
  };
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

function DailyOccupancyContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allItems, setAllItems] = useState<ItemWithStats[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState<EditedValues>({});
  const [occupancyCount, setOccupancyCount] = useState<number>(0);
  const [isOccupancyEditing, setIsOccupancyEditing] = useState(false);
  const [tempOccupancyCount, setTempOccupancyCount] = useState<number>(0);

  const [kitchenId, setKitchenId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getDateFromUrl = () => {
    const paramDate = searchParams.get("date");
    if (paramDate) return paramDate;
    
    // Check localStorage first for instant loading
    const cachedDate = readFromStorage(STORAGE_KEYS.LAST_DATE);
    if (cachedDate) return cachedDate;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDate = getDateFromUrl();
  const [dateInputValue, setDateInputValue] = useState(selectedDate);
  const searchQuery = searchParams.get("q") || "";

  // Sync Local State
  useEffect(() => {
     setDateInputValue(selectedDate);
  }, [selectedDate]);


  const updateUrl = (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
          params.set(key, value);
      } else {
          params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
  };

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

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setDateInputValue(val);
      if (val) {
          updateUrl("date", val);
          saveDatePreference(val);
      }
  };

  const handlePrevDay = () => {
    const currentDate = new Date(selectedDate!);
    currentDate.setDate(currentDate.getDate() - 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
    saveDatePreference(newDateStr);
  };

  const handleNextDay = () => {
    const currentDate = new Date(selectedDate!);
    currentDate.setDate(currentDate.getDate() + 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
    saveDatePreference(newDateStr);
  };


  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
       if (!selectedDate) return;
       setLoading(true);
       try {
           // 1. Fetch All Items
           const itemsRes = await fetch("/api/items");
           const allItemsData: Item[] = await itemsRes.json();
           
           // Filter for Daily Count items
           const dailyItems = allItemsData.filter(i => i.isDailyCount);

           // Fetch User & Locations
           const [userRes, locRes, occupancyRes] = await Promise.all([
               fetch("/api/auth/me"),
               fetch("/api/locations"),
               fetch(`/api/occupancy?date=${selectedDate}`)
           ]);
                      const user = await userRes.json();
            
            // Check for saved date preference if no date in URL
            const urlDate = searchParams.get("date");
            if (!urlDate && user.lastSelectedDate && user.lastSelectedDate !== selectedDate) {
                 updateUrl("date", user.lastSelectedDate);
                 return; // Stop loading for "Today", wait for redirect
            }

            const locations = await locRes.json();
           const occupancyData = await occupancyRes.json();
           
           setOccupancyCount(occupancyData.count || 0);

           // Determine Location - Always Kitchen
           const kitchen = locations.find((l: any) => l.name.toLowerCase() === "kitchen");
           
           if (!kitchen) {
               console.warn("Kitchen location not found");
               setLoading(false);
               return;
           }
           const targetLocationId = kitchen._id;
           setKitchenId(targetLocationId);

           // 3. Fetch Opening Balances & Current Transactions using combined API
            const params = new URLSearchParams({
                date: selectedDate,
                location: targetLocationId,
            });
            
            const response = await fetch(`/api/stock/combined?${params}`);
            const data = await response.json();

            const openingBalances = data.openingBalances || {};
            const transactions = data.transactions || {};

            // Filter items to only those assigned to the current location
            const targetLocation = kitchen;
            const validItemIds = targetLocation?.items || [];
            const locationDailyItems = dailyItems.filter(item => validItemIds.includes(item._id));

            const mappedItems = locationDailyItems.map(item => {
                const t = transactions[item._id];
                return {
                    ...item,
                    openingBalanceUnit: openingBalances[item._id]?.unit || 0,
                    consumedUnit: t?.consumedUnit || 0,
                    purchasedUnit: t?.purchasedUnit || 0
                };
            });

            setAllItems(mappedItems);

       } catch(e) {
           console.error(e);
       } finally {
           setLoading(false);
       }
  }, [selectedDate, searchParams]); // dependencies

  useEffect(() => {
      loadData();
  }, [loadData]);


  // Occupancy Logic
  const handleUpdateOccupancy = async () => {
    try {
        await fetch("/api/occupancy", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ date: selectedDate, count: tempOccupancyCount })
        });
        setOccupancyCount(tempOccupancyCount);
        setIsOccupancyEditing(false);
    } catch(e) { console.error(e) }
  };

  // Stock Edit Logic
  const handleEditStock = () => {
      const initial: EditedValues = {};
      allItems.forEach(i => {
          initial[i._id] = {
              consumedUnit: i.consumedUnit,
              purchasedUnit: i.purchasedUnit
          };
      });
      setEditedValues(initial);
      setIsEditMode(true);
  };

   const handleValueChange = (itemId: string, field: "consumedUnit" | "purchasedUnit", val: number) => {
      setEditedValues(prev => ({
          ...prev, 
          [itemId]: { ...prev[itemId], [field]: val }
      }));
   };

   const handleSaveStock = async () => {
       setSaving(true);
       try {
           if (!kitchenId) throw new Error("No kitchen location found");

           const promises = Object.entries(editedValues)
            .filter(([itemId, val]) => {
                const item = allItems.find(i => i._id === itemId);
                const opening = item?.openingBalanceUnit || 0;
                
                // Skip if everything is zero
                if (opening === 0 && val.purchasedUnit === 0 && val.consumedUnit === 0) {
                    return false;
                }
                return true;
            })
            .map(([itemId, val]) => {
               // Logic:
               // In Stock Count, we save `counted` and `consumed` is derived or passed.
               // Here we Edit `consumed` and `purchased`.
               // We probably need to calculate `counted` (Closing) to maintain consistency for Opening Balance Logic?
               // Opening Balance Logic looks for `countedUnit`.
               // Closing = Opening + Purchased - Consumed.
               const item = allItems.find(i => i._id === itemId);
               const opening = item?.openingBalanceUnit || 0;
               const closing = opening + val.purchasedUnit - val.consumedUnit;

               return fetch("/api/transactions", {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({
                       date: selectedDate,
                       item: itemId,
                       location: kitchenId,
                       consumedUnit: val.consumedUnit,
                       purchasedUnit: val.purchasedUnit,
                       countedUnit: closing, // Auto-calculate closing/count
                       // Packages? User said "editable in units only". So packages unchanged?
                       // We should probably preserve existing count or 0? 
                       // Let's assume 0 for package delta if not tracked here.
                   })
               });
           });
           
           await Promise.all(promises);
           await loadData();
           setIsEditMode(false);
           setEditedValues({});

       } catch(e) {
           console.error(e);
       } finally {
           setSaving(false);
       }
   };

   const filteredItems = allItems
        .filter(i => i.item.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            const subCatA = a.subCategory || "";
            const subCatB = b.subCategory || "";
            if (subCatA < subCatB) return -1;
            if (subCatA > subCatB) return 1;
            return a.item.localeCompare(b.item);
        });
   // Pagination
   const paginatedItems = filteredItems.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
   const totalPages = Math.ceil(filteredItems.length / itemsPerPage);


   const getDisplayVal = (itemId: string, field: "consumedUnit" | "purchasedUnit") => {
       if (isEditMode && editedValues[itemId]) return editedValues[itemId][field];
       const item = allItems.find(i => i._id === itemId);
       return item ? item[field] : 0;
   }

   return (
    <div className="w-full h-full flex flex-col">
      {/* Top Controls */}
      <div className="border-b bg-white px-4 py-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Daily Occupancy</span>
        </div>

        {/* Mobile: Stacked rows */}
        <div className="md:hidden space-y-3">
          {/* Row 1: Search + Occupancy */}
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
            {/* Occupancy Count */}
            <div className="flex items-center gap-2 px-3 bg-purple-50 rounded-lg border border-purple-200">
              {isOccupancyEditing ? (
                <div className="flex items-center gap-1">
                  <Input 
                    type="number" 
                    value={tempOccupancyCount} 
                    onChange={(e) => setTempOccupancyCount(parseInt(e.target.value) || 0)}
                    className="w-16 h-8 text-center text-sm"
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                  <Button size="sm" onClick={handleUpdateOccupancy} className="h-8 px-2">
                    <Save className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 cursor-pointer" onClick={() => { setTempOccupancyCount(occupancyCount); setIsOccupancyEditing(true); }}>
                  <span className="text-lg font-bold text-purple-600">{occupancyCount}</span>
                  <span className="text-xs text-purple-500">ppl</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Date & Update Button */}
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handlePrevDay} disabled={isEditMode}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateInputValue}
                onChange={handleDateInput}
                className="w-[130px] pl-8 h-10 text-xs"
                disabled={isEditMode}
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleNextDay} disabled={isEditMode}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            {!isEditMode ? (
              <Button onClick={handleEditStock} size="icon" className="h-10 w-10 shrink-0">
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => { setIsEditMode(false); setEditedValues({}); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" className="h-10 w-10" onClick={handleSaveStock} disabled={saving}>
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

          {/* Occupancy Count */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
            <span className="text-sm text-purple-600 font-medium">Occupancy:</span>
            {isOccupancyEditing ? (
              <div className="flex items-center gap-1">
                <Input 
                  type="number" 
                  value={tempOccupancyCount} 
                  onChange={(e) => setTempOccupancyCount(parseInt(e.target.value) || 0)}
                  className="w-16 h-7 text-center text-sm"
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                />
                <Button size="sm" onClick={handleUpdateOccupancy} className="h-7 px-2">
                  <Save className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 cursor-pointer" onClick={() => { setTempOccupancyCount(occupancyCount); setIsOccupancyEditing(true); }}>
                <span className="text-lg font-bold text-purple-600">{occupancyCount}</span>
                <span className="text-xs text-purple-500">people</span>
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrevDay} disabled={isEditMode}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateInputValue}
                onChange={handleDateInput}
                className="w-[140px] pl-9 h-9"
                disabled={isEditMode}
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleNextDay} disabled={isEditMode}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Action Buttons */}
          {!isEditMode ? (
            <Button onClick={handleEditStock} size="sm">
              <Pencil className="h-4 w-4 mr-2" />
              Update Record
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setIsEditMode(false); setEditedValues({}); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveStock} disabled={saving}>
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
                  <div className="h-16 bg-blue-50 rounded-lg"></div>
                  <div className="h-16 bg-blue-50 rounded-lg"></div>
                  <div className="h-16 bg-green-50 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Utensils className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Items Found</p>
            <p className="text-sm text-center">{searchQuery ? "No items match your search." : "No daily count items configured for Kitchen."}</p>
          </div>
        ) : (
          <>
            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paginatedItems.map((item) => {
                const opening = item.openingBalanceUnit;
                const purchase = getDisplayVal(item._id, "purchasedUnit");
                const consumed = getDisplayVal(item._id, "consumedUnit");
                const closing = opening + purchase - consumed;
                
                return (
                  <div key={item._id} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                    {/* Item Name */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-orange-500" />
                        <Link href={`/admin/items/${item._id}`} className="font-semibold text-gray-900 hover:text-primary hover:underline text-lg">
                          {item.item}
                        </Link>
                      </div>
                      {item.cookingQty && (
                        <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded">{item.cookingQty}</span>
                      )}
                    </div>
                    
                    {/* Values Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Opening Balance */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Opening</p>
                        <p className="text-lg font-bold text-gray-700">{opening}</p>
                      </div>
                      
                      {/* Purchase - Editable */}
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 mb-1">Purchase</p>
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={purchase}
                            onChange={(e) => handleValueChange(item._id, "purchasedUnit", parseInt(e.target.value) || 0)}
                            className="h-10 text-lg font-bold text-center border-blue-200 focus-visible:ring-blue-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <p className="text-lg font-bold text-blue-700">{purchase}</p>
                        )}
                      </div>
                      
                      {/* Consumed - Editable */}
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-600 mb-1">Consumed</p>
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={consumed}
                            onChange={(e) => handleValueChange(item._id, "consumedUnit", parseInt(e.target.value) || 0)}
                            className="h-10 text-lg font-bold text-center border-orange-200 focus-visible:ring-orange-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <p className="text-lg font-bold text-orange-700">{consumed}</p>
                        )}
                      </div>
                      
                      {/* Closing Balance */}
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 mb-1">Closing</p>
                        <p className="text-lg font-bold text-green-700">{closing}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg border shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="font-semibold pl-4">Item</TableHead>
                    <TableHead className="font-semibold text-center w-[100px]">Cooking Qty</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-gray-50/50">Opening</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-blue-50/50">Purchase</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-orange-50/50">Consumed</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-green-50/50">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item, index) => {
                    const opening = item.openingBalanceUnit;
                    const purchase = getDisplayVal(item._id, "purchasedUnit");
                    const consumed = getDisplayVal(item._id, "consumedUnit");
                    const closing = opening + purchase - consumed;
                    
                    const prevItem = index > 0 ? paginatedItems[index - 1] : null;
                    const showHeader = !prevItem || item.subCategory !== prevItem.subCategory;
                    const subCategoryLabel = item.subCategory || "Other";

                    return (
                      <Fragment key={item._id}>
                        {showHeader && (
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={6} className="font-semibold text-primary py-2">
                              {subCategoryLabel}
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell className="font-medium pl-8">
                            <div className="flex items-center gap-2">
                              <Utensils className="h-3 w-3 text-orange-500" />
                              <Link href={`/admin/items/${item._id}`} className="hover:underline hover:text-primary">
                                {item.item}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{item.cookingQty || "-"}</TableCell>
                          <TableCell className="text-center font-medium text-gray-600 bg-gray-50/30">
                            {opening}
                          </TableCell>
                          <TableCell className="text-center bg-blue-50/20">
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={purchase}
                                onChange={(e) => handleValueChange(item._id, "purchasedUnit", parseInt(e.target.value) || 0)}
                                className="w-16 mx-auto text-center h-8 border-blue-200 focus-visible:ring-blue-400"
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              />
                            ) : (
                              <span>{purchase}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center bg-orange-50/20">
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={consumed}
                                onChange={(e) => handleValueChange(item._id, "consumedUnit", parseInt(e.target.value) || 0)}
                                className="w-16 mx-auto text-center h-8 border-orange-200 focus-visible:ring-orange-400"
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              />
                            ) : (
                              <span>{consumed}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-700 bg-green-50/20">
                            {closing}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
      
      {/* Pagination Controls */}
      {!loading && paginatedItems.length > 0 && (
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

export default function DailyOccupancyPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
            <DailyOccupancyContent />
        </Suspense>
    );
}

