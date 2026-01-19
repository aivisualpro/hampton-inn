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
};

type ItemWithPurchase = Item & {
  openingBalanceUnit: number;
  openingBalancePackage: number;
  purchasedUnit: number;
  purchasedPackage: number;
};

type EditedValues = {
  [itemId: string]: {
    purchasedUnit: number;
    purchasedPackage: number;
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

function StockPurchaseContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [userLocations, setUserLocations] = useState<Location[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDate = getDateFromUrl();
  const searchQuery = searchParams.get("q") || "";

  const [dateInputValue, setDateInputValue] = useState(selectedDate);

  useEffect(() => {
    setDateInputValue(selectedDate);
  }, [selectedDate]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dateInputValue !== selectedDate) {
        updateUrl("date", dateInputValue);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dateInputValue, selectedDate, updateUrl]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInputValue(e.target.value);
  };

  const handlePrevDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
  };

  const handleNextDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    const newDateStr = currentDate.toISOString().split('T')[0];
    updateUrl("date", newDateStr);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedLocation]);

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

  // Initial data load
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
        updateUrl("date", user.lastSelectedDate);
      }
      
      setLoading(false);
    };
    loadData();
  }, []);

  // Items for current location with purchase data
  const [locationItems, setLocationItems] = useState<ItemWithPurchase[]>([]);

  // Fetch purchase data when location or date changes
  useEffect(() => {
    if (!selectedLocation || !selectedDate) return;
    
    // Reset edit mode when location or date changes
    setIsEditMode(false);
    setEditedValues({});
    
    const fetchPurchaseData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          date: selectedDate,
          location: selectedLocation._id,
        });
        
        const [openingRes, transRes] = await Promise.all([
          fetch(`/api/stock/opening-balance?${params}`),
          fetch(`/api/transactions?${params}`)
        ]);
        
        const openingBalances = await openingRes.json();
        const transactions = await transRes.json();
        
        const locationItemIds = selectedLocation.items || [];
        const filteredItems = allItems.filter(item => locationItemIds.includes(item._id));
        
        const openingMap = Array.isArray(openingBalances) 
          ? openingBalances.reduce((acc: any, curr: any) => ({
              ...acc, 
              [curr.item]: { unit: curr.openingBalance || 0, package: curr.openingBalancePackage || 0 }
            }), {})
          : {};
        
        const transMap = Array.isArray(transactions)
          ? transactions.reduce((acc: any, curr: any) => ({ ...acc, [curr.item]: curr }), {})
          : {};
        
        const mappedItems: ItemWithPurchase[] = filteredItems.map(item => ({
          ...item,
          openingBalanceUnit: openingMap[item._id]?.unit || 0,
          openingBalancePackage: openingMap[item._id]?.package || 0,
          purchasedUnit: transMap[item._id]?.purchasedUnit || 0,
          purchasedPackage: transMap[item._id]?.purchasedPackage || 0,
        }));
        
        setLocationItems(mappedItems);
      } catch (error) {
        console.error("Error fetching purchase data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (allItems.length > 0) {
      fetchPurchaseData();
    }
  }, [selectedLocation, selectedDate, allItems]);

  const handleLocationSelect = async (location: Location) => {
    setSelectedLocation(location);
    setIsLocationSelectorOpen(false);
    updateUrl("location", location._id);
    
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

  const handleUpdateStock = () => {
    const initial: EditedValues = {};
    locationItems.forEach(item => {
      initial[item._id] = {
        purchasedUnit: item.purchasedUnit,
        purchasedPackage: item.purchasedPackage,
      };
    });
    setEditedValues(initial);
    setIsEditMode(true);
  };

  const handleValueChange = (itemId: string, field: "purchasedUnit" | "purchasedPackage", value: number) => {
    setEditedValues(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };

  const getDisplayValue = (itemId: string, field: "purchasedUnit" | "purchasedPackage") => {
    if (isEditMode && editedValues[itemId]) {
      return editedValues[itemId][field];
    }
    const item = locationItems.find(i => i._id === itemId);
    return item ? item[field] : 0;
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditedValues({});
  };

  const handleSave = async () => {
    if (!selectedLocation) return;
    
    setSaving(true);
    try {
      const itemsToSave = Object.entries(editedValues).filter(([itemId, val]) => {
        const item = locationItems.find(i => i._id === itemId);
        const opening = item?.openingBalanceUnit || 0;
        const openingPkg = item?.openingBalancePackage || 0;
        
        if (opening === 0 && openingPkg === 0 && val.purchasedUnit === 0 && val.purchasedPackage === 0) {
          return false;
        }
        return true;
      });

      const promises = itemsToSave.map(([itemId, val]) => {
        const item = locationItems.find(i => i._id === itemId);
        const openingUnit = item?.openingBalanceUnit || 0;
        const openingPkg = item?.openingBalancePackage || 0;
        
        // Closing = Opening + Purchased
        const closingUnit = openingUnit + val.purchasedUnit;
        const closingPkg = openingPkg + val.purchasedPackage;
        
        return fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            item: itemId,
            location: selectedLocation._id,
            purchasedUnit: val.purchasedUnit,
            purchasedPackage: val.purchasedPackage,
            countedUnit: closingUnit,
            countedPackage: closingPkg,
          }),
        });
      });
      
      await Promise.all(promises);
      
      toast({ title: "Success", description: "Purchase data saved successfully." });
      setIsEditMode(false);
      setEditedValues({});
      
      // Refresh data
      const params = new URLSearchParams({
        date: selectedDate,
        location: selectedLocation._id,
      });
      const transRes = await fetch(`/api/transactions?${params}`);
      const transactions = await transRes.json();
      
      const transMap = Array.isArray(transactions)
        ? transactions.reduce((acc: any, curr: any) => ({ ...acc, [curr.item]: curr }), {})
        : {};
      
      setLocationItems(prev => prev.map(item => ({
        ...item,
        purchasedUnit: transMap[item._id]?.purchasedUnit || 0,
        purchasedPackage: transMap[item._id]?.purchasedPackage || 0,
      })));
      
    } catch (error) {
      console.error("Error saving:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save purchase data." });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = locationItems.filter(item => 
    item.item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Controls */}
      <div className="border-b bg-white px-4 py-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Stock Purchase</span>
        </div>

        {/* Mobile: Stacked rows */}
        <div className="lg:hidden space-y-3">
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
        <div className="hidden lg:flex gap-3 items-center">
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
          {selectedLocation && locationItems.length > 0 && (
            <>
              {!isEditMode ? (
                <Button onClick={handleUpdateStock} size="sm">
                  <Pencil className="h-4 w-4 mr-2" />
                  Update Purchase
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

      {/* Items List */}
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
              {paginatedItems.map((item) => {
                const purchasedUnit = getDisplayValue(item._id, "purchasedUnit");
                const purchasedPackage = getDisplayValue(item._id, "purchasedPackage");
                const closingUnit = item.openingBalanceUnit + purchasedUnit;
                const closingPackage = item.openingBalancePackage + purchasedPackage;
                
                return (
                  <div key={item._id} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                    {/* Item Name */}
                    <div className="flex items-center justify-between">
                      <Link href={`/admin/items/${item._id}`} className="font-semibold text-gray-900 hover:text-primary hover:underline text-lg">
                        {item.item}
                      </Link>
                    </div>
                    
                    {/* Values Grid - 3 columns for purchase view */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="text-xs font-medium text-gray-500"></div>
                      <div className="text-xs font-medium text-gray-500">Units</div>
                      <div className="text-xs font-medium text-gray-500">Packages</div>
                    </div>
                    
                    {/* Opening */}
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-xs text-gray-500">Opening</div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-700">{item.openingBalanceUnit}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-700">{item.openingBalancePackage}</p>
                      </div>
                    </div>
                    
                    {/* Purchased */}
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-xs text-blue-600">Purchased</div>
                      <div className="bg-blue-50 rounded-lg p-1">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={purchasedUnit}
                            onChange={(e) => handleValueChange(item._id, "purchasedUnit", parseInt(e.target.value) || 0)}
                            className="h-8 text-sm font-bold text-center border-blue-200 focus-visible:ring-blue-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <p className="text-sm font-bold text-blue-700 text-center py-1">{purchasedUnit}</p>
                        )}
                      </div>
                      <div className="bg-blue-50 rounded-lg p-1">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            value={purchasedPackage}
                            onChange={(e) => handleValueChange(item._id, "purchasedPackage", parseInt(e.target.value) || 0)}
                            className="h-8 text-sm font-bold text-center border-blue-200 focus-visible:ring-blue-400"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <p className="text-sm font-bold text-blue-700 text-center py-1">{purchasedPackage}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Closing */}
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-xs text-green-600">Closing</div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-green-700">{closingUnit}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-green-700">{closingPackage}</p>
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
                    <TableHead className="font-semibold text-center w-[100px] bg-gray-50/50">Opening (Unit)</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-gray-50/50">Opening (Pkg)</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-blue-50/50">Purchased (Unit)</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-blue-50/50">Purchased (Pkg)</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-green-50/50">Closing (Unit)</TableHead>
                    <TableHead className="font-semibold text-center w-[100px] bg-green-50/50">Closing (Pkg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const purchasedUnit = getDisplayValue(item._id, "purchasedUnit");
                    const purchasedPackage = getDisplayValue(item._id, "purchasedPackage");
                    const closingUnit = item.openingBalanceUnit + purchasedUnit;
                    const closingPackage = item.openingBalancePackage + purchasedPackage;
                    
                    return (
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
                              value={purchasedUnit}
                              onChange={(e) => handleValueChange(item._id, "purchasedUnit", parseInt(e.target.value) || 0)}
                              className="w-16 mx-auto text-center h-8 border-blue-200 focus-visible:ring-blue-400"
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            />
                          ) : (
                            <span>{purchasedUnit}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center bg-blue-50/20">
                          {isEditMode ? (
                            <Input
                              type="number"
                              min="0"
                              value={purchasedPackage}
                              onChange={(e) => handleValueChange(item._id, "purchasedPackage", parseInt(e.target.value) || 0)}
                              className="w-16 mx-auto text-center h-8 border-blue-200 focus-visible:ring-blue-400"
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            />
                          ) : (
                            <span>{purchasedPackage}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-green-700 bg-green-50/20">
                          {closingUnit}
                        </TableCell>
                        <TableCell className="text-center font-bold text-green-700 bg-green-50/20">
                          {closingPackage}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {userLocations.map((location) => (
              <Button
                key={location._id}
                variant={selectedLocation?._id === location._id ? "default" : "outline"}
                className="w-full justify-start h-auto py-3"
                onClick={() => handleLocationSelect(location)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{location.name}</span>
                  {location.description && (
                    <span className="text-xs text-muted-foreground">{location.description}</span>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StockPurchasePage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <StockPurchaseContent />
    </Suspense>
  );
}
