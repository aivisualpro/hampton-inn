
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

  const saveDatePreference = async (dateStr: string) => {
      try {
          await fetch("/api/auth/me", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lastSelectedDate: dateStr })
          });
      } catch(e) {
         console.error("Failed to save date preference", e);
      }
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

           // 3. Fetch Opening Balances & Current Transactions for this Location & Date
            const params = new URLSearchParams({
                date: selectedDate,
                location: targetLocationId,
            });
            
            const [openingRes, transRes] = await Promise.all([
                fetch(`/api/stock/opening-balance?${params}`),
                fetch(`/api/transactions?${params}`)
            ]);

            const openingBalances = await openingRes.json();
            const transactions: any[] = await transRes.json();

            // Map data
            const openingMap = Array.isArray(openingBalances) ? 
                openingBalances.reduce((acc: any, curr: any) => ({...acc, [curr.item]: curr.openingBalance || 0}), {}) : {};
            
            const transMap = transactions.reduce((acc: any, curr: any) => ({...acc, [curr.item]: curr}), {});

            // Filter items to only those assigned to the current location
            const targetLocation = kitchen;
            const validItemIds = targetLocation?.items || [];
            const locationDailyItems = dailyItems.filter(item => validItemIds.includes(item._id));

            const mappedItems = locationDailyItems.map(item => {
                const t = transMap[item._id];
                return {
                    ...item,
                    openingBalanceUnit: openingMap[item._id] || 0,
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
       {/* Top Bar */}
      <div className="border-b bg-white px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Daily Occupancy</span>
        </div>

         {/* Search */}
         <div className="relative max-w-sm w-full md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search items..."
                className="w-full bg-background pl-8 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => updateUrl("q", e.target.value)}
              />
        </div>

        {/* Date Picker */}
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevDay} disabled={isEditMode}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    type="date"
                    value={dateInputValue}
                    onChange={handleDateInput}
                    className="w-auto pl-9 h-8"
                    disabled={isEditMode}
                />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextDay} disabled={isEditMode}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
        
        {/* Occupancy Count */}
        <div className="flex items-center gap-2 ml-4">
            <span className="text-sm font-medium">Occupancy:</span>
            {isOccupancyEditing ? (
                <div className="flex items-center gap-1">
                    <Input 
                        type="number" 
                        value={tempOccupancyCount} 
                        onChange={(e) => setTempOccupancyCount(parseInt(e.target.value) || 0)}
                        className="w-20 h-8"
                    />
                    <Button size="sm" onClick={handleUpdateOccupancy} className="h-8">Save</Button>
                </div>
            ) : (
                <div className="flex items-center gap-2 pointer-events-auto" onClick={() => { setTempOccupancyCount(occupancyCount); setIsOccupancyEditing(true); }}>
                    <span className="text-lg font-bold text-purple-600 cursor-pointer border-b border-dashed border-purple-300">{occupancyCount}</span>
                    <span className="text-xs text-muted-foreground">people</span>
                </div>
            )}
        </div>


        <div className="flex-1" />

        {/* Actions */}
        {!isEditMode ? (
            <Button onClick={handleEditStock}>
                <Pencil className="h-4 w-4 mr-2" /> Update Record
            </Button>
        ) : (
             <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setIsEditMode(false); setEditedValues({}); }}>Cancel</Button>
                <Button onClick={handleSaveStock} disabled={saving}>
                   {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
                </Button>
             </div>
        )}

      </div>

      {/* Table */}
       <div className="flex-1 overflow-auto bg-white">
          {loading ? (
             <div className="flex h-full items-center justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
          ) : !kitchenId ? (
             <div className="flex h-full items-center justify-center flex-col gap-2">
                 <h2 className="text-lg font-semibold text-red-600">Configuration Error</h2>
                 <p className="text-muted-foreground">"Kitchen" location not found. Please ensure a location named "Kitchen" exists.</p>
             </div>
          ) : (
            <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Cooking Qty</TableHead>
                        <TableHead className="text-center w-[150px]">Opening Balance</TableHead>
                         <TableHead className="text-center w-[150px] bg-blue-50/50">Purchase (Unit)</TableHead>
                        <TableHead className="text-center w-[150px] bg-blue-50/50">Daily Consumption (Unit)</TableHead>
                        <TableHead className="text-center w-[150px] bg-green-50/50">Closing Inventory</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedItems.map((item, index) => {
                         const opening = item.openingBalanceUnit;
                         const purchase = getDisplayVal(item._id, "purchasedUnit");
                         const consumed = getDisplayVal(item._id, "consumedUnit");
                         const closing = opening + purchase - consumed;
                         
                         // Determine if we need a group header
                         const prevItem = index > 0 ? paginatedItems[index - 1] : null;
                         const showHeader = !prevItem || item.subCategory !== prevItem.subCategory;
                         const subCategoryLabel = item.subCategory || "Other";

                        return (
                            <Fragment key={item._id}>
                                {showHeader && (
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableCell colSpan={7} className="font-semibold text-primary py-2">
                                            {subCategoryLabel}
                                        </TableCell>
                                    </TableRow>
                                )}
                                <TableRow>
                                    <TableCell className="font-medium pl-8">
                                        <div className="flex items-center gap-2">
                                            {item.isDailyCount && <Utensils className="h-3 w-3 text-orange-500" />}
                                            <Link href={`/admin/items/${item._id}`} className="hover:underline hover:text-primary">
                                                {item.item}
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.package || "-"}</TableCell>
                                    <TableCell>{item.cookingQty || "-"}</TableCell>
                                    <TableCell className="text-center">{opening}</TableCell>
                                    <TableCell className="text-center bg-blue-50/20">
                                        {isEditMode ? (
                                            <Input type="number" min="0" value={purchase} 
                                               onChange={(e) => handleValueChange(item._id, "purchasedUnit", parseInt(e.target.value)||0)}
                                               className="w-20 mx-auto text-center h-8 border-blue-200"
                                               onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            />
                                        ) : purchase}
                                    </TableCell>
                                    <TableCell className="text-center bg-blue-50/20">
                                         {isEditMode ? (
                                            <Input type="number" min="0" value={consumed} 
                                               onChange={(e) => handleValueChange(item._id, "consumedUnit", parseInt(e.target.value)||0)}
                                               className="w-20 mx-auto text-center h-8 border-blue-200"
                                               onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            />
                                        ) : consumed}
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-gray-700 bg-green-50/20">
                                        {closing}
                                    </TableCell>
                                </TableRow>
                            </Fragment>
                        );
                    })}
                </TableBody>
            </Table>
          )}
       </div>
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

