"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, MapPin, ChevronDown, Calendar, Pencil, Save, ChevronRight, Search, ChevronLeft } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Location = {
  _id: string;
  name: string;
  description?: string;
  inventoryType?: string;
  category?: string;
  items?: string[];
};

type Item = {
  _id: string;
  item: string;
  package?: string;
  restockPackageQty: number;
};

type Transaction = {
  _id?: string;
  date: string;
  item: string;
  location: string;
  countedUnit: number;
  countedPackage: number;
  purchasedUnit?: number;
  purchasedPackage?: number;
  consumedUnit?: number;
  consumedPackage?: number;
  soakUnit?: number;
  soakPackage?: number;
};

type ItemWithCount = Item & {
  openingBalanceUnit: number;
  openingBalancePackage: number;
  countedUnit: number;
  countedPackage: number;
};

type EditedValues = {
  [itemId: string]: {
    countedUnit: number | string;
    countedPackage: number | string;
  };
};

type User = {
  _id: string;
  name: string;
  email: string;
  locations: string[];
  lastSelectedLocation?: string;
  lastSelectedDate?: string;
};

// LocalStorage keys for instant loading
const STORAGE_KEYS = {
  LAST_LOCATION: "hampton_last_location",
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

function StockCountContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [userLocations, setUserLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState<EditedValues>({});
  const { toast } = useToast();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getDateFromUrl = () => {
    const paramDate = searchParams.get("date");
    if (paramDate) return paramDate;
    
    // Fallback logic moved to useEffect to wait for user data, 
    // but initially we return current date or wait?
    // Let's keep returning Today as default for initial render, 
    // and let useEffect override it if user has a saved date.
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDate = getDateFromUrl();
  const [dateInputValue, setDateInputValue] = useState(selectedDate);

  // Sync local state when URL date changes (e.g. via Next/Prev buttons)
  useEffect(() => {
    setDateInputValue(selectedDate);
  }, [selectedDate]);

  const searchQuery = searchParams.get("q") || "";

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
      // Write to localStorage IMMEDIATELY for instant loading
      writeToStorage(STORAGE_KEYS.LAST_DATE, dateStr);
      
      // Sync to server (async, non-blocking)
      fetch("/api/auth/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastSelectedDate: dateStr })
      }).catch(e => console.error("Failed to save date preference", e));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDateInputValue(newDate);
    // Only update URL if it's a valid date string (standard date input returns YYYY-MM-DD or empty)
    if (newDate) {
        updateUrl("date", newDate);
        saveDatePreference(newDate);
    }
  };

  const handlePrevDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
    saveDatePreference(newDateStr);
  };

  const handleNextDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
    saveDatePreference(newDateStr);
  };

  const [visibleCount, setVisibleCount] = useState(20);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset visible count on search or location/date change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, selectedLocation, selectedDate]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (loading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loading]);

  // Fetch current user
  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
    return null;
  };

  // Fetch all locations
  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations");
      if (response.ok) {
        const data = await response.json();
        setAllLocations(data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
    return [];
  };

  // Fetch all items
  const fetchItems = async () => {
    try {
      const response = await fetch("/api/items");
      if (response.ok) {
        const data = await response.json();
        setAllItems(data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    }
    return [];
  };

  // Fetch combined stock data (opening balances + transactions) in a single call
  const fetchStockData = useCallback(async () => {
    if (!selectedLocation || !selectedDate) {
      setTransactions([]);
      setOpeningBalancesMap({});
      return;
    }

    try {
      const params = new URLSearchParams({
        date: selectedDate,
        location: selectedLocation._id,
      });

      const response = await fetch(`/api/stock/combined?${params}`);
      const data = await response.json();

      if (data.transactions) {
        // Convert map back to array, adding the item ID to each transaction
        const txnArray = Object.entries(data.transactions).map(([itemId, values]: [string, any]) => ({
          item: itemId,
          ...values,
        }));
        setTransactions(txnArray);
      }
      
      if (data.openingBalances) {
        // Convert to expected format
        const openingMap: any = {};
        for (const [itemId, values] of Object.entries(data.openingBalances as Record<string, any>)) {
          openingMap[itemId] = {
            item: itemId,
            openingBalance: values.unit || 0,
            openingBalancePackage: values.package || 0,
          };
        }
        setOpeningBalancesMap(openingMap);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedLocation, selectedDate]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // STEP 1: Read from localStorage IMMEDIATELY for instant UI
      const cachedLocationId = readFromStorage(STORAGE_KEYS.LAST_LOCATION);
      const cachedDate = readFromStorage(STORAGE_KEYS.LAST_DATE);
      
      // Apply cached date to URL if not already specified
      const urlDate = searchParams.get("date");
      if (!urlDate && cachedDate) {
        const params = new URLSearchParams(window.location.search);
        params.set("date", cachedDate);
        router.replace(`${pathname}?${params.toString()}`);
      }
      
      // STEP 2: Fetch data from APIs
      const [user, locations] = await Promise.all([
        fetchCurrentUser(),
        fetchLocations(),
        fetchItems(),
      ]);
      
      // Filter locations based on user's assigned locations
      let filteredLocations = locations;
      if (user && user.locations && user.locations.length > 0) {
        filteredLocations = locations.filter((loc: Location) => 
          user.locations.some((userLocIdOrName: string) => 
            String(userLocIdOrName) === String(loc._id) || 
            String(userLocIdOrName) === loc.name
          )
        );
      }
      setUserLocations(filteredLocations);

       // STEP 3: Set initial location (priority: URL > localStorage > server > first available)
       const urlLocationId = searchParams.get("location");
       let initialLocation: Location | undefined;

       // Try URL first
       if (urlLocationId) {
          initialLocation = filteredLocations.find((l: Location) => l._id === urlLocationId);
       } 
       
       // Try localStorage cache (instant)
       if (!initialLocation && cachedLocationId) {
          initialLocation = filteredLocations.find((l: Location) => l._id === cachedLocationId);
       }
       
       // Try server preference
       if (!initialLocation && user?.lastSelectedLocation) {
          initialLocation = filteredLocations.find((l: Location) => l._id === user.lastSelectedLocation);
          // Sync localStorage with server preference
          if (initialLocation) {
            writeToStorage(STORAGE_KEYS.LAST_LOCATION, initialLocation._id);
          }
       }

       if (initialLocation) {
         setSelectedLocation(initialLocation);
          // Sync URL if it was empty but we found a default
          if (!urlLocationId) {
             const params = new URLSearchParams(window.location.search);
             params.set("location", initialLocation._id);
             router.replace(`${pathname}?${params.toString()}`);
          }
       }
       
       // Handle server date preference (only if not in URL or localStorage)
       if (!urlDate && !cachedDate && user?.lastSelectedDate) {
           updateUrl("date", user.lastSelectedDate);
           writeToStorage(STORAGE_KEYS.LAST_DATE, user.lastSelectedDate);
       }
      
      setLoading(false);
    };
    loadData();
  }, []);

  // Load Transactions and Opening Balances when location or date changes
  useEffect(() => {
    if (selectedLocation && selectedDate) {
      setLoading(true);
      fetchStockData()
        .finally(() => setLoading(false));

      setIsEditMode(false);
      setEditedValues({});
    }
  }, [fetchStockData, selectedDate, selectedLocation]);

  const [openingBalancesMap, setOpeningBalancesMap] = useState<any>({});

  const handleSelectLocation = async (location: Location) => {
    setSelectedLocation(location);
    setIsLocationSelectorOpen(false);
    updateUrl("location", location._id);
    
    // Write to localStorage IMMEDIATELY for instant loading next time
    writeToStorage(STORAGE_KEYS.LAST_LOCATION, location._id);

    // Persist to user profile (async, non-blocking)
    try {
        await fetch("/api/auth/me", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lastSelectedLocation: location._id })
        });
    } catch(e) {
        console.error("Failed to save location preference", e);
    }
  };

  // Enable edit mode and initialize edited values
  const handleUpdateStock = () => {
    const initialValues: EditedValues = {};
    locationItems.forEach(item => {
      initialValues[item._id] = {
        countedUnit: item.countedUnit === 0 ? "" : item.countedUnit,
        countedPackage: item.countedPackage === 0 ? "" : item.countedPackage,
      };
    });
    setEditedValues(initialValues);
    setIsEditMode(true);
  };

  // Handle value change in edit mode
  const handleValueChange = (
    itemId: string,
    field: "countedUnit" | "countedPackage",
    value: number | string
  ) => {
    setEditedValues(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const getPackageSize = (pkgStr?: string) => {
      if (!pkgStr) return 1;
      // Extract first number found in string, e.g. "Case of 12" -> 12
      const match = pkgStr.match(/(\d+)/);
      return match ? parseInt(match[0], 10) : 1;
  };

  // Save all edited values
  const handleSave = async () => {
    if (!selectedLocation || !selectedDate) return;

    // VALIDATION STEP
    const errors: string[] = [];
    
    Object.entries(editedValues).forEach(([itemId, values]) => {
        const itemOpening = openingBalancesMap[itemId];
        const openingUnit = itemOpening?.openingBalance || 0;
        const openingPackage = itemOpening?.openingBalancePackage || 0;
        
        const valCountedUnit = values.countedUnit === "" ? 0 : Number(values.countedUnit);
        const valCountedPackage = values.countedPackage === "" ? 0 : Number(values.countedPackage);

        // Skip if everything 0
        if (openingUnit === 0 && openingPackage === 0 && valCountedUnit === 0 && valCountedPackage === 0) return;

        const itemDef = allItems.find(i => i._id === itemId);
        const pkgSize = getPackageSize(itemDef?.package);
        
        const totalOpening = (openingPackage * pkgSize) + openingUnit;
        const totalCounted = (valCountedPackage * pkgSize) + valCountedUnit;

        // If Opening > 0 and Count > Opening -> Error
        if (totalOpening > 0 && totalCounted > totalOpening) {
            errors.push(`${itemDef?.item || "Item"}: Count (${totalCounted}) exceeds Opening (${totalOpening}). Please add a Purchase.`);
        }
    });

    if (errors.length > 0) {
        setValidationError(errors[0]);
        return;
    }

    // 1. Optimistic Update
    const previousTransactions = [...transactions];
    const updatedTransactions = [...transactions];
    
    // We update local state to reflect changes immediately
    Object.entries(editedValues).forEach(([itemId, values]) => {
         const valCountedUnit = values.countedUnit === "" ? 0 : Number(values.countedUnit);
         const valCountedPackage = values.countedPackage === "" ? 0 : Number(values.countedPackage);

         // Find existing transaction in our local list
         const existingIndex = updatedTransactions.findIndex(t => t.item === itemId);
         
         if (existingIndex >= 0) {
             updatedTransactions[existingIndex] = {
                 ...updatedTransactions[existingIndex],
                 countedUnit: valCountedUnit,
                 countedPackage: valCountedPackage
             };
         } else {
             updatedTransactions.push({
                 _id: `temp-${itemId}`, // Temporary ID
                 date: selectedDate,
                 item: itemId,
                 location: selectedLocation._id,
                 countedUnit: valCountedUnit,
                 countedPackage: valCountedPackage
             });
         }
    });

    setTransactions(updatedTransactions);
    setIsEditMode(false);
    setEditedValues({});
    toast({ 
        title: "Updates applied", 
        description: "Syncing with database...",
    });
    
    setSaving(true);
    try {
      const savePromises = Object.entries(editedValues)
        .map(([itemId, values]) => {
           const itemOpening = openingBalancesMap[itemId];
           const openingUnit = itemOpening?.openingBalance || 0;
           const openingPackage = itemOpening?.openingBalancePackage || 0;
           
           const valCountedUnit = values.countedUnit === "" ? 0 : Number(values.countedUnit);
           const valCountedPackage = values.countedPackage === "" ? 0 : Number(values.countedPackage);

           if (openingUnit === 0 && openingPackage === 0 && valCountedUnit === 0 && valCountedPackage === 0) {
               return null;
           }

           const itemDef = allItems.find(i => i._id === itemId);
           const pkgSize = getPackageSize(itemDef?.package);
           const totalOpening = (openingPackage * pkgSize) + openingUnit;
           
           const txnInfo = transactions.find(t => t.item === itemId);
           const todayPurchasedUnit = txnInfo?.purchasedUnit || 0;
           const todayPurchasedPackage = txnInfo?.purchasedPackage || 0;
           const totalPurchasedToday = (todayPurchasedPackage * pkgSize) + todayPurchasedUnit;
           
           const todayConsumedUnit = txnInfo?.consumedUnit || 0;
           const todayConsumedPackage = txnInfo?.consumedPackage || 0;
           const totalConsumedToday = (todayConsumedPackage * pkgSize) + todayConsumedUnit;
           
           const todaySoakUnit = txnInfo?.soakUnit || 0;
           const todaySoakPackage = txnInfo?.soakPackage || 0; // Assuming soak supports packages? combined API supports it.
           const totalSoakToday = (todaySoakPackage * pkgSize) + todaySoakUnit;

           const totalAvailable = totalOpening + totalPurchasedToday - totalConsumedToday - totalSoakToday;

           let consumedUnit = 0;
           let consumedPackage = 0;
           let purchasedUnit = 0;
           let purchasedPackage = 0;

           const totalCounted = (valCountedPackage * pkgSize) + valCountedUnit;
           const diff = totalCounted - totalAvailable;

           if (diff > 0) {
               // Counted > Available -> Found extra items (Treat as Purchase Adjustment)
               // We add this adjustment to any existing purchase
               // But usually Stock Count adjustment is separate. 
               // Based on API fix, we might want to store this as the ONLY purchase value for this source?
               // Yes, source="Stock Count". So this purchasedUnit is the adjustment.
               
               const diffPkg = Math.floor(diff / pkgSize);
               const diffUnit = diff % pkgSize;
               
               purchasedUnit = diffUnit;
               purchasedPackage = diffPkg;
               consumedUnit = 0;
               consumedPackage = 0;
           } else {
               // Available >= Counted -> Consumed items
               const consumption = -diff; // Positive consumption
               const consPkg = Math.floor(consumption / pkgSize);
               const consUnit = consumption % pkgSize;
               
               consumedUnit = consUnit;
               consumedPackage = consPkg;
               purchasedUnit = 0;
               purchasedPackage = 0;
           }

        return fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            item: itemId,
            location: selectedLocation._id,
            countedUnit: valCountedUnit,
            countedPackage: valCountedPackage,
            consumedUnit: consumedUnit,
            consumedPackage: consumedPackage,
            purchasedUnit: purchasedUnit,
            purchasedPackage: purchasedPackage,
            source: "Stock Count",
          }),
        });
      })
      .filter(p => p !== null) as Promise<Response>[];

      await Promise.all(savePromises);
      // ... same as before


      await Promise.all(savePromises);

      // Refresh transactions silently to get real IDs and ensure consistency
      await fetchStockData();
      
      toast({ title: "Success", description: "All changes saved successfully." });

    } catch (error) {
      console.error("Error saving transactions:", error);
      // Revert Optimistic Update
      setTransactions(previousTransactions);
      toast({ 
          variant: "destructive", 
          title: "Save Failed", 
          description: "Could not save changes. Reverting to previous state." 
      });
    } finally {
      setSaving(false);
    }
  };

  // Cancel edit mode
  const handleCancel = () => {
    setIsEditMode(false);
    setEditedValues({});
  };

  // Get items for the selected location with their counted values
  const locationItems: ItemWithCount[] = (selectedLocation?.items
    ?.map(itemId => {
      const item = allItems.find(i => i._id === itemId);
      if (!item) return null;
      
      const transaction = transactions.find(t => t.item === itemId);
      const openingRecord = openingBalancesMap[itemId];

      return {
        ...item,
        openingBalanceUnit: openingRecord?.openingBalance || 0,
        openingBalancePackage: openingRecord?.openingBalancePackage || 0,
        countedUnit: transaction?.countedUnit || 0,
        countedPackage: transaction?.countedPackage || 0,
      };
    })
    .filter(Boolean) as ItemWithCount[]) || [];

  const filteredItems = locationItems.filter((item) => 
    item.item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedItems = filteredItems.slice(0, visibleCount);

  // Get display value (edited value if in edit mode, otherwise transaction value)
  const getDisplayValue = (itemId: string, field: "countedUnit" | "countedPackage") => {
    if (isEditMode && editedValues[itemId]) {
      return editedValues[itemId][field];
    }
    const item = locationItems.find(i => i._id === itemId);
    // If not edit mode, also return "" for 0
    if (item && item[field] !== 0) {
        return item[field];
    }
    return "";
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Controls */}
      <div className="border-b bg-white px-4 py-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 md:hidden">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Stock Count</span>
        </div>
        {/* Breadcrumbs */}


        {/* Mobile: Stacked rows */}
        <div className="md:hidden space-y-3">
          {/* Row 1: Location & Search */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-between text-left h-10"
              onClick={() => setIsLocationSelectorOpen(true)}
              disabled={isEditMode}
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className={selectedLocation ? "font-medium truncate" : "text-muted-foreground truncate"}>
                  {selectedLocation ? selectedLocation.name : "Select Location"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
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

          {/* Row 2: Date & Update Stock Button */}
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handlePrevDay} disabled={isEditMode}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateInputValue}
                onChange={handleDateChange}
                className="w-[130px] pl-8 h-10 text-xs"
                disabled={isEditMode}
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleNextDay} disabled={isEditMode}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            {selectedLocation && locationItems.length > 0 && (
              <>
                {!isEditMode ? (
                  <Button onClick={handleUpdateStock} size="icon" className="h-10 w-10 shrink-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={handleCancel} disabled={saving}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="icon" className="h-10 w-10" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Desktop: Single row */}
        <div className="hidden md:flex gap-3 items-center">
          {/* Breadcrumbs (Inline) */}
           <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
             <Link href="/" className="hover:text-primary hover:underline">Home</Link>
             <ChevronRight className="h-4 w-4" />
             <span className="font-medium text-foreground">Stock Count</span>
           </div>
          {/* Location Selector */}
          <Button
            variant="outline"
            className="w-[200px] justify-between text-left h-9"
            onClick={() => setIsLocationSelectorOpen(true)}
            disabled={isEditMode}
          >
            <div className="flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={selectedLocation ? "font-medium truncate" : "text-muted-foreground truncate"}>
                {selectedLocation ? selectedLocation.name : "Select Location"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </Button>

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
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrevDay} disabled={isEditMode}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateInputValue}
                onChange={handleDateChange}
                className="w-[180px] pl-9 h-9"
                disabled={isEditMode}
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleNextDay} disabled={isEditMode}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Action Buttons */}
          {selectedLocation && locationItems.length > 0 && (
            <>
              {!isEditMode ? (
                <Button onClick={handleUpdateStock} size="sm">
                  <Pencil className="h-4 w-4 mr-2" />
                  Update Stock
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save
                  </Button>
                </div>
              )}
            </>
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
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-blue-50 rounded-lg"></div>
                  <div className="h-16 bg-blue-50 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        ) : !selectedLocation ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MapPin className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Location Selected</p>
            <p className="text-sm">Please select a location to view its items</p>
          </div>
        ) : locationItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-lg font-medium">No Items</p>
            <p className="text-sm">This location has no items assigned</p>
          </div>
        ) : (
          <>
            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayedItems.map((item) => (
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
                      <p className="text-xs text-gray-500 mb-1">Opening (Unit)</p>
                      <p className="text-lg font-bold text-gray-700">{item.openingBalanceUnit}</p>
                    </div>
                    {(!!item.package && item.package !== "0") && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Opening (Pkg)</p>
                      <p className="text-lg font-bold text-gray-700">{item.openingBalancePackage}</p>
                    </div>
                    )}
                    
                    {/* Count - Editable in Edit Mode */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 mb-1">Count (Unit)</p>
                      {isEditMode ? (
                        <Input
                          type="number"
                          min="0"
                          value={getDisplayValue(item._id, "countedUnit")}
                          onChange={(e) => handleValueChange(item._id, "countedUnit", parseInt(e.target.value) || 0)}
                          className="h-10 text-lg font-bold text-center border-blue-200 focus-visible:ring-blue-400"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <p className="text-lg font-bold text-blue-700">{item.countedUnit}</p>
                      )}
                    </div>
                    {(!!item.package && item.package !== "0") && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 mb-1">Count (Pkg)</p>
                      {isEditMode ? (
                        <Input
                          type="number"
                          min="0"
                          value={getDisplayValue(item._id, "countedPackage")}
                          onChange={(e) => handleValueChange(item._id, "countedPackage", parseInt(e.target.value) || 0)}
                          className="h-10 text-lg font-bold text-center border-blue-200 focus-visible:ring-blue-400"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <p className="text-lg font-bold text-blue-700">{item.countedPackage}</p>
                      )}
                    </div>
                    )}
                    
                    {/* Closing Balance */}
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-1">Closing (Unit)</p>
                      <p className="text-lg font-bold text-green-700">{getDisplayValue(item._id, "countedUnit")}</p>
                    </div>
                    {(!!item.package && item.package !== "0") && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-1">Closing (Pkg)</p>
                      <p className="text-lg font-bold text-green-700">{getDisplayValue(item._id, "countedPackage")}</p>
                    </div>
                    )}
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
                    <TableHead className="font-semibold text-center w-[130px] bg-gray-50/50">Opening (Unit)</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-gray-50/50">Opening (Pkg)</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-blue-50/50">Count Unit</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-blue-50/50">Count Pkg</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-green-50/50">Closing (Unit)</TableHead>
                    <TableHead className="font-semibold text-center w-[130px] bg-green-50/50">Closing (Pkg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedItems.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium pl-4">
                        <Link href={`/admin/items/${item._id}`} className="hover:underline hover:text-primary">
                          {item.item}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-600 bg-gray-50/30">
                        {item.openingBalanceUnit}
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-600 bg-gray-50/30">
                        {(!!item.package && item.package !== "0") ? item.openingBalancePackage : "-"}
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={getDisplayValue(item._id, "countedUnit")}
                            onChange={(e) => handleValueChange(item._id, "countedUnit", e.target.value)}
                            className="w-20 mx-auto text-center h-8 border-blue-200 focus-visible:ring-blue-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <span>{item.countedUnit === 0 ? "" : item.countedUnit}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/20">
                        {!(!!item.package && item.package !== "0") ? (
                            <span className="text-muted-foreground">-</span>
                        ) : isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={getDisplayValue(item._id, "countedPackage")}
                            onChange={(e) => handleValueChange(item._id, "countedPackage", e.target.value)}
                            className="w-20 mx-auto text-center h-8 border-blue-200 focus-visible:ring-blue-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <span>{item.countedPackage === 0 ? "" : item.countedPackage}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-700 bg-green-50/20">
                        {getDisplayValue(item._id, "countedUnit") || ""}
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-700 bg-green-50/20">
                        {(!!item.package && item.package !== "0") ? (getDisplayValue(item._id, "countedPackage") || "") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        
        {/* Observer Target for Infinite Scroll - Moved INSIDE scroll container */}
        <div ref={observerTarget} className="p-4 text-center text-sm text-muted-foreground w-full">
            {displayedItems.length < filteredItems.length ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Loading more items...
              </>
            ) : (
              displayedItems.length > 0 && "No more items"
            )}
        </div>
      </div>
      
      <div className="p-4 border-t bg-white text-xs text-muted-foreground text-center">
        Showing {displayedItems.length} of {filteredItems.length} items
      </div>

      {/* Location Selector Dialog */}
      <Dialog open={isLocationSelectorOpen} onOpenChange={setIsLocationSelectorOpen}>
        <DialogContent className="sm:max-w-[400px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Location</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : userLocations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No locations assigned to you.
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {userLocations.map((location) => (
                  <div
                    key={location._id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                      selectedLocation?._id === location._id ? "bg-primary/10 border border-primary/30" : ""
                    }`}
                    onClick={() => handleSelectLocation(location)}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{location.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {location.items?.length || 0} items
                      </p>
                    </div>
                    {selectedLocation?._id === location._id && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Error Alert */}
      <AlertDialog open={!!validationError} onOpenChange={(open) => !open && setValidationError(null)}>
        <AlertDialogContent className="bg-red-50 border-red-200 text-red-900 border-2">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-red-900 flex items-center gap-2">
                    Validation Error
                </AlertDialogTitle>
                <AlertDialogDescription className="text-red-800 font-medium">
                    {validationError}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setValidationError(null)} className="bg-red-100 text-red-900 hover:bg-red-200 border border-red-200">
                    Okay
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function StockCountPage() {
  return (
    <Suspense fallback={
       <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
       </div>
    }>
      <StockCountContent />
    </Suspense>
  );
}
