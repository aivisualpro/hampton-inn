"use client";

import { useEffect, useState, useCallback, Suspense, Fragment, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, Calendar, Pencil, Save, ChevronRight, ChevronLeft, Search, Utensils, Camera, ImagePlus, Trash2, X, Eye, Upload, CheckCircle2, AlertCircle } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  openingBalancePackage: number;
  openingTotal: number; // Total opening = (packages × package size) + units
  consumedUnit: number | string; // Editable
  purchasedUnit: number; // Read-only for calculation and validation
};

type EditedValues = {
  [itemId: string]: {
    consumedUnit: number | string;
  };
};

type BreakfastImageType = {
  _id: string;
  date: string;
  url: string;
  publicId: string;
  thumbnailUrl: string;
  createdAt: string;
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
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allItems, setAllItems] = useState<ItemWithStats[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState<EditedValues>({});
  const [occupancyCount, setOccupancyCount] = useState<number>(0);
  const [occupancyPercentage, setOccupancyPercentage] = useState<number>(0);
  const [isOccupancyEditing, setIsOccupancyEditing] = useState(false);
  const [tempOccupancyCount, setTempOccupancyCount] = useState<number>(0);
  const [tempOccupancyPercentage, setTempOccupancyPercentage] = useState<number>(0);

  // Image states
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [breakfastImages, setBreakfastImages] = useState<BreakfastImageType[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [imageMax, setImageMax] = useState(3);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDeleting, setImageDeleting] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [kitchenId, setKitchenId] = useState<string | null>(null);

  // Prevent hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getDateFromUrl = () => {
    const paramDate = searchParams.get("date");
    if (paramDate) return paramDate;
    
    // Check localStorage first
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
      const params = new URLSearchParams(searchParams.toString());
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
       // Ensure URL always has date
       const urlDate = searchParams.get("date");
       if (!urlDate) {
         updateUrl("date", selectedDate);
         return; 
       }

       setLoading(true);
       try {
           // 1. Fetch All Items
           const itemsRes = await fetch("/api/items");
           const allItemsData: Item[] = await itemsRes.json();
           
           // Filter for Daily Count items
           const dailyItems = allItemsData.filter(i => i.isDailyCount);

           // Fetch User & Locations
           const [locRes, occupancyRes] = await Promise.all([
               fetch("/api/locations"),
               fetch(`/api/occupancy?date=${selectedDate}`)
           ]);
           // Note: user preference we handle via storage priority mainly, 
           // and we accept what's in URL as truth.

           const locations = await locRes.json();
           const occupancyData = await occupancyRes.json();
           
           setOccupancyCount(occupancyData.count || 0);
           setOccupancyPercentage(occupancyData.percentage || 0);
           
           // Sync API data to URL if missing or different
           const currentOccupancy = searchParams.get("occupancy");
           const currentPeople = searchParams.get("people");
           
           if (currentOccupancy !== String(occupancyData.percentage || 0) || currentPeople !== String(occupancyData.count || 0)) {
                updateUrlParams({
                    occupancy: occupancyData.percentage || 0,
                    people: occupancyData.count || 0
                });
           }

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
                
                // For Daily Occupancy, the "opening" is today's Stock Count
                // (the countedUnit/Package represents available stock for the day)
                // If there's a Stock Count today, use those values
                // Otherwise fall back to previous day's closing balance
                const hasStockCountToday = t?.countedUnit !== undefined || t?.countedPackage !== undefined;
                
                const openingUnit = hasStockCountToday 
                    ? (t.countedUnit || 0) 
                    : (openingBalances[item._id]?.unit || 0);
                const openingPackage = hasStockCountToday 
                    ? (t.countedPackage || 0) 
                    : (openingBalances[item._id]?.package || 0);
                    
                const packageSize = parseInt(item.package || '0') || 0;
                const openingTotal = (openingPackage * packageSize) + openingUnit;
                
                return {
                    ...item,
                    openingBalanceUnit: openingUnit,
                    openingBalancePackage: openingPackage,
                    openingTotal: openingTotal,
                    consumedUnit: t?.consumedUnit || "",
                    purchasedUnit: (t?.purchasedUnit || 0) + ((t?.purchasedPackage || 0) * packageSize)
                };
            });

            setAllItems(mappedItems);

       } catch(e) {
           console.error(e);
       } finally {
           setLoading(false);
       }
  }, [selectedDate, searchParams]); // dependencies

  // ── Image Functions ──────────────────────────────────────────────────
  const loadImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/breakfast-images?date=${selectedDate}`);
      const data = await res.json();
      setBreakfastImages(data.images || []);
      setImageCount(data.count || 0);
      setImageMax(data.max || 3);
    } catch (e) {
      console.error("Failed to load images:", e);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleImageUpload = async (file: File) => {
    if (imageCount >= imageMax) {
      toast({ variant: "destructive", title: "Limit Reached", description: `Maximum ${imageMax} images per day.` });
      return;
    }
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("date", selectedDate);
      const res = await fetch("/api/breakfast-images", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await loadImages();
      toast({ title: "Image Uploaded", description: "Breakfast image added successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: e.message || "Failed to upload image." });
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageDelete = async (id: string) => {
    setImageDeleting(id);
    try {
      const res = await fetch(`/api/breakfast-images?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await loadImages();
      toast({ title: "Image Deleted", description: "Image removed successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: e.message || "Failed to delete image." });
    } finally {
      setImageDeleting(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) handleImageUpload(files[0]);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) handleImageUpload(files[0]);
  };

  useEffect(() => {
      loadData();
  }, [loadData]);


   // Sync URL update helper
   const updateUrlParams = (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== "") {
              params.set(key, String(value));
          } else {
              params.delete(key);
          }
      });
      router.replace(`${pathname}?${params.toString()}`);
   };

   // Occupancy Logic
   const handleUpdateOccupancy = async () => {
    try {
        await fetch("/api/occupancy", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ 
              date: selectedDate, 
              count: tempOccupancyCount,
              percentage: tempOccupancyPercentage 
            })
        });
        setOccupancyCount(tempOccupancyCount);
        setOccupancyPercentage(tempOccupancyPercentage);
        updateUrlParams({
            occupancy: tempOccupancyPercentage,
            people: tempOccupancyCount
        });
        setIsOccupancyEditing(false);
        
        // Sync to URL
        updateUrlParams({
            date: selectedDate,
            count: tempOccupancyCount,
            percentage: tempOccupancyPercentage
        });

    } catch(e) { console.error(e) }
  };

  // Stock Edit Logic
  const handleEditStock = () => {
      const initial: EditedValues = {};
      allItems.forEach(i => {
          const cookingQty = parseInt(i.cookingQty || '1') || 1;
          const storedValue = Number(i.consumedUnit || 0);
          // Convert stored units back to servings for display in edit mode
          const displayValue = storedValue > 0 ? Math.round(storedValue / cookingQty) : "";
          
          initial[i._id] = {
              consumedUnit: displayValue,
          };
      });
      setEditedValues(initial);
      setIsEditMode(true);
  };

   const handleValueChange = (itemId: string, val: number | string) => {
      // Validation Logic
      const item = allItems.find(i => i._id === itemId);
      if (item) {
          const cookingQty = parseInt(item.cookingQty || '1') || 1;
          const available = item.openingTotal + (item.purchasedUnit || 0);
          const numVal = Number(val);
          const actualConsumed = numVal * cookingQty; // Multiply by cooking qty
          
          if (actualConsumed > available) {
              toast({
                  variant: "destructive",
                  title: "Insufficient Stock",
                  description: `Cannot consume ${numVal} (${actualConsumed} units). Only ${available} available. Add purchases first.`
              });
              // Prevent the invalid value from being set in the state.
              return; 
          }
      }

      setEditedValues(prev => ({
          ...prev, 
          [itemId]: { consumedUnit: val }
      }));
   };

   const handleSaveStock = async () => {
       setSaving(true);
       try {
           if (!kitchenId) throw new Error("No kitchen location found");

           const promises = Object.entries(editedValues)
            .map(([itemId, val]) => {
               const item = allItems.find(i => i._id === itemId);
               const cookingQty = parseInt(item?.cookingQty || '1') || 1;
               
               const enteredConsumed = val.consumedUnit === "" ? 0 : Number(val.consumedUnit);
               const actualConsumed = enteredConsumed * cookingQty; // Multiply by cooking qty
               
               // Skip if nothing to save
               if (actualConsumed === 0) {
                   return null;
               }

               // Don't need to calculate closing here - just save the consumption
               // The closing is calculated dynamically in the UI based on opening - consumed

               return fetch("/api/transactions", {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({
                       date: selectedDate,
                       item: itemId,
                       location: kitchenId,
                       consumedUnit: actualConsumed, // Save only the consumed units
                       source: "Daily Occupancy"     // Mark as daily occupancy transaction
                       // Other fields (counted, purchased, soak) will remain empty as defaults are disabled
                   })
               });
            })
            .filter(p => p !== null) as Promise<Response>[];

           
           await Promise.all(promises);
           await loadData();
           setIsEditMode(false);
           setEditedValues({});
           toast({ title: "Success", description: "Occupancy data saved." });

       } catch(e) {
           console.error(e);
           toast({ variant: "destructive", title: "Error", description: "Failed to save." });
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


   const getDisplayVal = (itemId: string) => {
       if (isEditMode && editedValues[itemId]) return editedValues[itemId].consumedUnit;
       const item = allItems.find(i => i._id === itemId);
       if (item && item.consumedUnit !== 0 && item.consumedUnit !== "") {
            // Convert from stored units back to servings by dividing by cookingQty
            const cookingQty = parseInt(item.cookingQty || '1') || 1;
            const rawConsumed = Number(item.consumedUnit) / cookingQty;
            return Math.round(rawConsumed); // Round to avoid floating point issues
       }
       return "";
   }

   // Format stock display as "packages/units(total)" e.g., "20/0(200)"
   const formatStockDisplay = (packages: number, units: number, total: number) => {
       if (packages === 0 && units === 0) return "0";
       return `${packages}/${units}(${total})`;
   }

   // Prevent hydration mismatch - don't render until client-side mounted
   if (!mounted) {
     return (
       <div className="w-full h-full flex items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin" />
       </div>
     );
   }

   return (
    <div className="w-full h-full flex flex-col">
      {/* Top Controls */}
      <div className="border-b bg-white px-4 py-3">
        {/* Desktop: Single Combined Row */}
        <div className="hidden md:flex items-center justify-between gap-4">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                <Link href="/" className="hover:text-primary hover:underline">Home</Link>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">Breakfast Consumption</span>
            </div>
            
            <div className="flex-1" />

            {/* Controls Group */}
            <div className="flex items-center gap-3">
                 {/* Search */}
                <div className="relative w-48 lg:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    type="search"
                    placeholder="Search items..."
                    className="w-full pl-8 h-9 text-sm"
                    value={searchQuery}
                    onChange={(e) => updateUrl("q", e.target.value)}
                    />
                </div>

                {/* Image Upload Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 gap-2 border-2 transition-all duration-200 ${
                    imageCount > 0
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400'
                      : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400'
                  }`}
                  onClick={() => setImageModalOpen(true)}
                >
                  <Camera className="h-4 w-4" />
                  <span className="text-sm font-semibold">{imageCount}/{imageMax}</span>
                  {imageCount >= imageMax && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                </Button>

                {/* Occupancy Count */}
                <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 rounded-lg border border-purple-200 h-9">
                    <span className="text-sm text-purple-600 font-medium">Occupancy</span>
                    {isOccupancyEditing ? (
                    <div className="flex items-center gap-2">
                        <Input 
                            type="number" 
                            value={tempOccupancyPercentage} 
                            onChange={(e) => setTempOccupancyPercentage(Number(e.target.value) || 0)}
                            className="w-16 h-7 text-center text-sm p-0"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            placeholder="%"
                        />
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">#</span>
                            <Input 
                                type="number" 
                                value={tempOccupancyCount} 
                                onChange={(e) => setTempOccupancyCount(parseInt(e.target.value) || 0)}
                                className="w-16 h-7 text-center text-sm pl-4 p-0"
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                placeholder="#"
                            />
                        </div>
                        <Button size="sm" onClick={handleUpdateOccupancy} className="h-7 px-2">
                        <Save className="h-3 w-3" />
                        </Button>
                    </div>
                    ) : (
                    <div className="flex items-center gap-3 cursor-pointer hover:bg-purple-100/50 rounded px-2 py-0.5 transition-colors" onClick={() => { 
                        setTempOccupancyCount(occupancyCount); 
                        setTempOccupancyPercentage(occupancyPercentage);
                        setIsOccupancyEditing(true); 
                    }}>
                        <div className="flex items-center gap-1">
                        <span className="text-base font-bold text-purple-600">{occupancyPercentage}%</span>
                        </div>
                        <div className="h-4 w-px bg-purple-300"></div>
                        <div className="flex items-center gap-1">
                        <span className="text-base font-bold text-purple-600">{occupancyCount}</span>
                        <span className="text-xs text-purple-500">ppl</span>
                        </div>
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
                        className="w-[140px] pl-9 h-9 text-sm"
                        disabled={isEditMode}
                    />
                    </div>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleNextDay} disabled={isEditMode}>
                    <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Action Buttons */}
                {!isEditMode ? (
                    <Button onClick={handleEditStock} size="sm" className="h-9">
                    <Pencil className="h-4 w-4 mr-2" />
                    Update Record
                    </Button>
                ) : (
                    <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setIsEditMode(false); setEditedValues({}); }} className="h-9">
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveStock} disabled={saving} className="h-9">
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                    </Button>
                    </div>
                )}
            </div>
        </div>

        {/* Mobile: Stacked rows (Unchanged Logic, just ensuring it renders when hidden md is true) */}
        <div className="md:hidden space-y-3">
          {/* Row 1: Search + Occupancy */}
          <div className="flex flex-col gap-2">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="w-full pl-8 h-10"
                value={searchQuery}
                onChange={(e) => updateUrl("q", e.target.value)}
              />
            </div>
            
            {/* Occupancy Count Mobile */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
               <span className="text-sm font-medium text-purple-700">Occupancy</span>
              {isOccupancyEditing ? (
                <div className="flex items-center gap-2">
                   <Input 
                     type="number" 
                     value={tempOccupancyPercentage} 
                     onChange={(e) => setTempOccupancyPercentage(Number(e.target.value) || 0)}
                     className="w-14 h-8 text-center text-sm"
                     onWheel={(e) => (e.target as HTMLInputElement).blur()}
                     placeholder="%"
                   />
                   <div className="flex items-center gap-1">
                      <span className="text-xs text-purple-600">#</span>
                      <Input 
                        type="number" 
                        value={tempOccupancyCount} 
                        onChange={(e) => setTempOccupancyCount(parseInt(e.target.value) || 0)}
                        className="w-14 h-8 text-center text-sm"
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        placeholder="#"
                      />
                   </div>
                  <Button size="sm" onClick={handleUpdateOccupancy} className="h-8 px-2">
                    <Save className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => { 
                    setTempOccupancyCount(occupancyCount); 
                    setTempOccupancyPercentage(occupancyPercentage);
                    setIsOccupancyEditing(true); 
                }}>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-purple-600">{occupancyPercentage}%</span>
                  </div>
                  <div className="h-4 w-px bg-purple-200"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-purple-600">{occupancyCount}</span>
                    <span className="text-xs text-purple-500">ppl</span>
                  </div>
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
            {/* Image Upload Button - Mobile */}
            <Button
              variant="outline"
              size="icon"
              className={`h-10 w-10 shrink-0 border-2 transition-all duration-200 relative ${
                imageCount > 0
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
              onClick={() => setImageModalOpen(true)}
            >
              <Camera className="h-4 w-4" />
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {imageCount}
              </span>
            </Button>
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
                const openingPackages = item.openingBalancePackage;
                const openingUnits = item.openingBalanceUnit;
                const opening = item.openingTotal;
                const packageSize = parseInt(item.package || '0') || 0;
                const cookingQty = parseInt(item.cookingQty || '1') || 1;
                const purchased = item.purchasedUnit || 0;
                const consumed = getDisplayVal(item._id);
                
                // If editing, utilize the value from the input (servings). 
                // If not editing, 'consumed' is the value from getDisplayVal, which IS NOW ALSO SERVINGS (divided by cookingQty).
                // So in ALL cases, we multiply by cookingQty to get the total units to subtract.
                const isEditing = isEditMode && editedValues[item._id] !== undefined;
                const displayConsumed = Number(consumed || 0);
                const actualConsumed = displayConsumed * cookingQty;
                
                const closingTotal = opening + purchased - actualConsumed;
                // Calculate closing packages and units (assume units consumed first, then packages)
                const closingPackages = packageSize > 0 ? Math.floor(closingTotal / packageSize) : 0;
                const closingUnits = packageSize > 0 ? closingTotal % packageSize : closingTotal;
                
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
                    <div className="grid grid-cols-3 gap-3">
                      {/* Opening Balance */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Opening</p>
                        <p className="text-lg font-bold text-gray-700">{formatStockDisplay(openingPackages, openingUnits, opening)}</p>
                      </div>
                      
                      {/* Consumed - Editable */}
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-600 mb-1">Consumed</p>
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={consumed}
                            onChange={(e) => handleValueChange(item._id, e.target.value)}
                            className="h-10 text-lg font-bold text-center border-orange-200 focus-visible:ring-orange-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <p className="text-lg font-bold text-orange-700">{consumed === 0 ? "" : consumed}</p>
                        )}
                      </div>
                      
                      {/* Closing Balance */}
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 mb-1">Closing</p>
                        <p className="text-lg font-bold text-green-700">{formatStockDisplay(closingPackages, closingUnits, closingTotal)}</p>
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
                    <TableHead className="font-semibold text-center w-[100px] bg-orange-50/50">Consumed</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-green-50/50">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item, index) => {
                    const openingPackages = item.openingBalancePackage;
                    const openingUnits = item.openingBalanceUnit;
                    const opening = item.openingTotal;
                    const packageSize = parseInt(item.package || '0') || 0;
                    const cookingQty = parseInt(item.cookingQty || '1') || 1;
                    const purchased = item.purchasedUnit || 0;
                    const consumed = getDisplayVal(item._id);
                    
                    // If editing, utilize the value from the input (servings). 
                    // If not editing, 'consumed' is the value from getDisplayVal, which IS NOW ALSO SERVINGS (divided by cookingQty).
                    // So in ALL cases, we multiply by cookingQty to get the total units to subtract.
                    const isEditing = isEditMode && editedValues[item._id] !== undefined;
                    const displayConsumed = Number(consumed || 0);
                    const actualConsumed = displayConsumed * cookingQty;
                    
                    const closingTotal = opening + purchased - actualConsumed;
                    const closingPackages = packageSize > 0 ? Math.floor(closingTotal / packageSize) : 0;
                    const closingUnits = packageSize > 0 ? closingTotal % packageSize : closingTotal;
                    
                    const prevItem = index > 0 ? paginatedItems[index - 1] : null;
                    const showHeader = !prevItem || item.subCategory !== prevItem.subCategory;
                    const subCategoryLabel = item.subCategory || "Other";

                    return (
                      <Fragment key={item._id}>
                        {showHeader && (
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={5} className="font-semibold text-primary py-2">
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
                            {formatStockDisplay(openingPackages, openingUnits, opening)}
                          </TableCell>
                          <TableCell className="text-center bg-orange-50/20">
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={consumed}
                                onChange={(e) => handleValueChange(item._id, e.target.value)}
                                className="w-16 mx-auto text-center h-8 border-orange-200 focus-visible:ring-orange-400"
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              />
                            ) : (
                              <span>{consumed === 0 ? "" : consumed}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-700 bg-green-50/20">
                            {formatStockDisplay(closingPackages, closingUnits, closingTotal)}
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

      {/* ── Breakfast Image Modal ────────────────────────────────────────── */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0" showCloseButton={false}>
          {/* Header with gradient */}
          <div className="relative overflow-hidden rounded-t-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500 opacity-90" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjYSkiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIi8+PC9zdmc+')] opacity-30" />
            <div className="relative px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Breakfast Photos
                </h2>
                <p className="text-white/80 text-xs mt-0.5">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                  {[...Array(imageMax)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                        i < imageCount
                          ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)] scale-110'
                          : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setImageModalOpen(false)}
                  className="rounded-full p-1.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Image Gallery */}
            {breakfastImages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <Eye className="h-4 w-4" />
                  <span>Uploaded Images ({imageCount}/{imageMax})</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {breakfastImages.map((img) => (
                    <div
                      key={img._id}
                      className="group relative aspect-square rounded-xl overflow-hidden border-2 border-gray-100 shadow-sm hover:shadow-lg hover:border-orange-200 transition-all duration-300"
                    >
                      <img
                        src={img.url}
                        alt="Breakfast"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      
                      {/* Action buttons */}
                      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                        <button
                          onClick={() => setPreviewImage(img.url)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 text-gray-700" />
                        </button>
                        <button
                          onClick={() => handleImageDelete(img._id)}
                          disabled={imageDeleting === img._id}
                          className="p-2 bg-red-500/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {imageDeleting === img._id ? (
                            <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 text-white" />
                          )}
                        </button>
                      </div>

                      {/* Upload time badge */}
                      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Zone */}
            {imageCount < imageMax && (
              <div
                className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ${
                  dragOver
                    ? 'border-orange-400 bg-orange-50 scale-[1.02] shadow-lg shadow-orange-100'
                    : 'border-gray-200 bg-gray-50/50 hover:border-orange-300 hover:bg-orange-50/30'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {imageUploading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
                      <Upload className="h-5 w-5 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-sm text-orange-600 font-medium animate-pulse">Uploading image...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center shadow-sm">
                        <ImagePlus className="h-7 w-7 text-orange-500" />
                      </div>
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-orange-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                        {imageMax - imageCount}
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-gray-700">Add Breakfast Photo</p>
                      <p className="text-xs text-gray-400">Drag & drop or use buttons below</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 rounded-xl shadow-sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Gallery
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-xl shadow-sm shadow-orange-200"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4" />
                        Camera
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All slots filled */}
            {imageCount >= imageMax && (
              <div className="flex items-center gap-3 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
                <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">All photos uploaded!</p>
                  <p className="text-xs text-emerald-600">All {imageMax} image slots are filled for this date.</p>
                </div>
              </div>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
        </DialogContent>
      </Dialog>

      {/* ── Fullscreen Image Preview (Lightbox) ─────────────────────────── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={previewImage}
            alt="Breakfast - Full Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
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
