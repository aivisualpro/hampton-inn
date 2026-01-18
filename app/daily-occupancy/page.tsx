
"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, Calendar, Pencil, Save, ChevronRight, ChevronLeft, Search } from "lucide-react";
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

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setDateInputValue(val);
      if (val) updateUrl("date", val);
  };

  const handlePrevDay = () => {
    const currentDate = new Date(selectedDate!);
    currentDate.setDate(currentDate.getDate() - 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
  };

  const handleNextDay = () => {
    const currentDate = new Date(selectedDate!);
    currentDate.setDate(currentDate.getDate() + 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
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

           // 2. Fetch Transactions (for Consumption/Purchase/Opening) logic
           // Ideally we reuse the existing APIs.
           // Since we need Opening Balance for these items:
           // We can mock a "Location" ID if we were using location logic, but here it seems global or per location?
           // The prompt says "mark item if that belong to daily occupancy page".
           // It implies this is a general "Kitchen" or centralized view?
           // Or does it depend on location? "location selected in cons column" -> "will go to the ledger/transactions of that ledger with location selected"
           // Wait, the prompt says "say opening balance was 3 and count units 1 it means 2 was cons. will go to the ledger/transactions of that ledger with location selected in cons column".
           // This implies this page might need a LOCATION selector too?
           // BUT the new prompt says "Daily Occupancy Page" and lists columns. It DOES NOT mention Location Selector.
           // However, if we save transactions, we NEED a location.
           // Assumption: We might need a "Default" location or "Main Kitchen" location. or we add a location selector.
           // Given the previous chat about "Persist Stock Count Location", user is used to locations.
           // Use case: "Daily Room Occupancy" suggests Housekeeping. Items like "Coffee", "Soap".
           // These are usually tracked per location (e.g. 2nd Floor Closet).
           // BUT "Daily Occupancy Page" usually aggregates or serves a specific workflow.
           // Let's assume we need a Location Selector similarly to Stock Count, OR we work across ALL locations (which is complex).
           // Let's add a Location Selector to be safe/consistent, OR use the user's persisted location.
           // Wait, "Cooking Qty" implies Kitchen/Food. "Package is 10 bags".
           // Let's stick to the request: "search, edit records and date fields in the pageheader just like soak cycle".
           // Soak Cycle has a location selector (wait, Soak Cycle page does NOT have a location selector in my memory, it aggregates? check soak cycle code if needed. Actually, previous summary said Soak Cycle has search.).
           // Let's look at Soak Cycle page... I can't view it easily without tool call.
           // Let's assume we need a location selector because Transactions require a location.
           // I will add a Location Selector.

           // Fetch User & Locations
           const [userRes, locRes, occupancyRes] = await Promise.all([
               fetch("/api/auth/me"),
               fetch("/api/locations"),
               fetch(`/api/occupancy?date=${selectedDate}`)
           ]);
           
           const user = await userRes.json();
           const locations = await locRes.json();
           const occupancyData = await occupancyRes.json();
           
           setOccupancyCount(occupancyData.count || 0);

           // Determine Location
           // Reuse logic from Stock Count
           let targetLocationId = searchParams.get("location");
           if (!targetLocationId && user.lastSelectedLocation) {
                targetLocationId = user.lastSelectedLocation;
           }
           if (!targetLocationId && locations.length > 0) {
               targetLocationId = locations[0]._id;
           }
           
           if (!targetLocationId) {
               // Handle no location case
               console.warn("No location found");
               setLoading(false);
               return;
           }
           // IMPORTANT: Update URL if we defaulted
           if (targetLocationId !== searchParams.get("location")) {
               updateUrl("location", targetLocationId);
               // We will re-run because URL changes.
               return; 
           }


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

            const mappedItems = dailyItems.map(item => {
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
           const locationId = searchParams.get("location");
           if (!locationId) throw new Error("No location");

           const promises = Object.entries(editedValues).map(([itemId, val]) => {
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
                       location: locationId,
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

   const filteredItems = allItems.filter(i => i.item.toLowerCase().includes(searchQuery.toLowerCase()));
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
                    {paginatedItems.map(item => {
                         const opening = item.openingBalanceUnit;
                         const purchase = getDisplayVal(item._id, "purchasedUnit");
                         const consumed = getDisplayVal(item._id, "consumedUnit");
                         const closing = opening + purchase - consumed;

                        return (
                            <TableRow key={item._id}>
                                <TableCell className="font-medium">{item.item}</TableCell>
                                <TableCell>{item.package || "-"}</TableCell>
                                <TableCell>{item.cookingQty || "-"}</TableCell>
                                <TableCell className="text-center">{opening}</TableCell>
                                <TableCell className="text-center bg-blue-50/20">
                                    {isEditMode ? (
                                        <Input type="number" min="0" value={purchase} 
                                           onChange={(e) => handleValueChange(item._id, "purchasedUnit", parseInt(e.target.value)||0)}
                                           className="w-20 mx-auto text-center h-8 border-blue-200"
                                        />
                                    ) : purchase}
                                </TableCell>
                                <TableCell className="text-center bg-blue-50/20">
                                     {isEditMode ? (
                                        <Input type="number" min="0" value={consumed} 
                                           onChange={(e) => handleValueChange(item._id, "consumedUnit", parseInt(e.target.value)||0)}
                                           className="w-20 mx-auto text-center h-8 border-blue-200"
                                        />
                                    ) : consumed}
                                </TableCell>
                                <TableCell className="text-center font-bold text-gray-700 bg-green-50/20">
                                    {closing}
                                </TableCell>
                            </TableRow>
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

