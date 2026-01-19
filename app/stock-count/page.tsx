"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
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
};

type ItemWithCount = Item & {
  openingBalanceUnit: number;
  openingBalancePackage: number;
  countedUnit: number;
  countedPackage: number;
};

type EditedValues = {
  [itemId: string]: {
    countedUnit: number;
    countedPackage: number;
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

function StockCountContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [userLocations, setUserLocations] = useState<Location[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
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

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  // Fetch transactions and opening balances for the selected date and location
  // Fetch transactions and opening balances for the selected date and location
  const findTransactions = useCallback(async () => {
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

      const [openingRes, currentRes] = await Promise.all([
        fetch(`/api/stock/opening-balance?${params}`),
        fetch(`/api/transactions?${params}`)
      ]);

      const openingData = await openingRes.json();
      const currentData = await currentRes.json();

      setTransactions(currentData);
      setOpeningBalancesMap(
        Array.isArray(openingData) ?
          openingData.reduce((acc: any, curr: any) => ({ ...acc, [curr.item]: curr }), {})
          : {}
      );
    } catch (e) {
      console.error(e);
    }
  }, [selectedLocation, selectedDate]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
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

       // Set initial location:
       // 1. URL Parameter
       // 2. User's Last Selected Location (if in allowed list)
       // 3. First available location
       const urlLocationId = searchParams.get("location");
       let initialLocation: Location | undefined;

       if (urlLocationId) {
          initialLocation = filteredLocations.find((l: Location) => l._id === urlLocationId);
       } 
       
       if (!initialLocation && user?.lastSelectedLocation) {
          initialLocation = filteredLocations.find((l: Location) => l._id === user.lastSelectedLocation);
          // If we fell back to saved preference, update the URL to match
          if (initialLocation) {
             // We can't use updateUrl here directly because we are inside useEffect
             // But we can let the state update trigger a re-render or side effect if needed
             // For now, let's just set the state. Ideally, we sync URL too.
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
       
       // Handle Saved Date Preference
       const urlDate = searchParams.get("date");
       if (!urlDate && user?.lastSelectedDate) {
           // If no date in URL, but user has saved date, use it
           updateUrl("date", user.lastSelectedDate);
       }
      
      setLoading(false);
    };
    loadData();
  }, []);

  // Load Transactions and Opening Balances when location or date changes
  useEffect(() => {
    if (selectedLocation && selectedDate) {
      setLoading(true);
      findTransactions()
        .finally(() => setLoading(false));

      setIsEditMode(false);
      setEditedValues({});
    }
  }, [findTransactions, selectedDate, selectedLocation]);

  const [openingBalancesMap, setOpeningBalancesMap] = useState<any>({});

  const handleSelectLocation = async (location: Location) => {
    setSelectedLocation(location);
    setIsLocationSelectorOpen(false);
    updateUrl("location", location._id);

    // Persist to user profile
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
        countedUnit: item.countedUnit,
        countedPackage: item.countedPackage,
      };
    });
    setEditedValues(initialValues);
    setIsEditMode(true);
  };

  // Handle value change in edit mode
  const handleValueChange = (
    itemId: string,
    field: "countedUnit" | "countedPackage",
    value: number
  ) => {
    setEditedValues(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  // Save all edited values
  const handleSave = async () => {
    if (!selectedLocation || !selectedDate) return;

    // 1. Optimistic Update
    const previousTransactions = [...transactions];
    const updatedTransactions = [...transactions];
    
    // We update local state to reflect changes immediately
    Object.entries(editedValues).forEach(([itemId, values]) => {
         const itemOpening = openingBalancesMap[itemId];
         const openingUnit = itemOpening?.openingBalance || 0;
         const openingPackage = itemOpening?.openingBalancePackage || 0;

         // Skip empty
         if (openingUnit === 0 && openingPackage === 0 && values.countedUnit === 0 && values.countedPackage === 0) return;
         
         // Find existing transaction in our local list
         const existingIndex = updatedTransactions.findIndex(t => t.item === itemId);
         
         if (existingIndex >= 0) {
             updatedTransactions[existingIndex] = {
                 ...updatedTransactions[existingIndex],
                 countedUnit: values.countedUnit,
                 countedPackage: values.countedPackage
             };
         } else {
             updatedTransactions.push({
                 _id: `temp-${itemId}`, // Temporary ID
                 date: selectedDate,
                 item: itemId,
                 location: selectedLocation._id,
                 countedUnit: values.countedUnit,
                 countedPackage: values.countedPackage
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
      // Save each edited item as a transaction
      const savePromises = Object.entries(editedValues)
        .filter(([itemId, values]) => {
           const itemOpening = openingBalancesMap[itemId];
           const openingUnit = itemOpening?.openingBalance || 0;
           const openingPackage = itemOpening?.openingBalancePackage || 0;

           if (openingUnit === 0 && openingPackage === 0 && values.countedUnit === 0 && values.countedPackage === 0) {
               return false;
           }
           return true;
        })
        .map(([itemId, values]) => {
        const itemOpening = openingBalancesMap[itemId];
        const openingUnit = itemOpening?.openingBalance || 0;
        const openingPackage = itemOpening?.openingBalancePackage || 0;

        const consumedUnit = openingUnit - values.countedUnit;
        const consumedPackage = openingPackage - values.countedPackage;

        return fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            item: itemId,
            location: selectedLocation._id,
            countedUnit: values.countedUnit,
            countedPackage: values.countedPackage,
            consumedUnit: consumedUnit,
            consumedPackage: consumedPackage,
          }),
        });
      });

      await Promise.all(savePromises);

      // Refresh transactions silently to get real IDs and ensure consistency
      await findTransactions();
      
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

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get display value (edited value if in edit mode, otherwise transaction value)
  const getDisplayValue = (itemId: string, field: "countedUnit" | "countedPackage") => {
    if (isEditMode && editedValues[itemId]) {
      return editedValues[itemId][field];
    }
    const item = locationItems.find(i => i._id === itemId);
    return item ? item[field] : 0;
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Controls - Mobile Optimized */}
      <div className="border-b bg-white px-4 py-3 space-y-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Stock Count</span>
        </div>

        {/* Row 1: Location & Search */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 justify-between text-left"
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
          <div className="relative flex-1">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={dateInputValue}
              onChange={handleDateChange}
              className="w-full pl-9 h-10"
              disabled={isEditMode}
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleNextDay} disabled={isEditMode}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          {/* Action Buttons */}
          {selectedLocation && locationItems.length > 0 && (
            <>
              {!isEditMode ? (
                <Button onClick={handleUpdateStock} className="shrink-0">
                  <Pencil className="h-4 w-4 mr-2" />
                  Update Stock
                </Button>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
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
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedItems.map((item) => (
                <div key={item._id} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                  {/* Item Name */}
                  <div className="flex items-center justify-between">
                    <Link href={`/admin/items/${item._id}`} className="font-semibold text-gray-900 hover:text-primary hover:underline text-lg">
                      {item.item}
                    </Link>
                    {item.package && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{item.package}</span>
                    )}
                  </div>
                  
                  {/* Values Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Opening Balance */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Opening (Unit)</p>
                      <p className="text-lg font-bold text-gray-700">{item.openingBalanceUnit}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Opening (Pkg)</p>
                      <p className="text-lg font-bold text-gray-700">{item.openingBalancePackage}</p>
                    </div>
                    
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
                    
                    {/* Closing Balance */}
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-1">Closing (Unit)</p>
                      <p className="text-lg font-bold text-green-700">{getDisplayValue(item._id, "countedUnit")}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-1">Closing (Pkg)</p>
                      <p className="text-lg font-bold text-green-700">{getDisplayValue(item._id, "countedPackage")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg border shadow-sm">
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
                  {paginatedItems.map((item) => (
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
                        {item.openingBalancePackage}
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={getDisplayValue(item._id, "countedUnit")}
                            onChange={(e) => handleValueChange(item._id, "countedUnit", parseInt(e.target.value) || 0)}
                            className="w-20 mx-auto text-center h-8 border-blue-200 focus-visible:ring-blue-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <span>{item.countedUnit}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={getDisplayValue(item._id, "countedPackage")}
                            onChange={(e) => handleValueChange(item._id, "countedPackage", parseInt(e.target.value) || 0)}
                            className="w-20 mx-auto text-center h-8 border-blue-200 focus-visible:ring-blue-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <span>{item.countedPackage}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-700 bg-green-50/20">
                        {getDisplayValue(item._id, "countedUnit")}
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-700 bg-green-50/20">
                        {getDisplayValue(item._id, "countedPackage")}
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
