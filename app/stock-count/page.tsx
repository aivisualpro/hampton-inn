"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, MapPin, ChevronDown, Calendar, Pencil, Save, ChevronRight, Search, ChevronLeft } from "lucide-react";
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

  const updateUrl = (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
          params.set(key, value);
      } else {
          params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
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

  // Fetch transactions for the selected date and location
  const fetchTransactions = useCallback(async () => {
    if (!selectedLocation || !selectedDate) {
      setTransactions([]);
      return;
    }
    
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        location: selectedLocation._id,
      });
      const response = await fetch(`/api/transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
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
      if (user && user.locations && user.locations.length > 0) {
        const filtered = locations.filter((loc: Location) => 
          user.locations.some((userLocIdOrName: string) => 
            String(userLocIdOrName) === String(loc._id) || 
            String(userLocIdOrName) === loc.name
          )
        );
        setUserLocations(filtered);
      } else {
        // If no user or no specific locations assigned, show all (for admin)
        setUserLocations(locations);
      }
      
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    fetchTransactions();
    // Reset edit mode when location or date changes
    setIsEditMode(false);
    setEditedValues({});
  }, [fetchTransactions]);

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
    setIsLocationSelectorOpen(false);
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

    setSaving(true);

    try {
      // Save each edited item as a transaction
      const savePromises = Object.entries(editedValues).map(([itemId, values]) => {
        return fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            item: itemId,
            location: selectedLocation._id,
            countedUnit: values.countedUnit,
            countedPackage: values.countedPackage,
          }),
        });
      });

      await Promise.all(savePromises);

      // Refresh transactions and exit edit mode
      await fetchTransactions();
      setIsEditMode(false);
      setEditedValues({});
    } catch (error) {
      console.error("Error saving transactions:", error);
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
      return {
        ...item,
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
      {/* Top Bar: Location Selector, Date Picker, and Action Buttons */}
      <div className="border-b bg-white px-4 py-3 flex flex-wrap gap-3 items-center">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Stock Count</span>
        </div>

        {/* Location Selector */}
        <Button
          variant="outline"
          className="justify-between min-w-[200px]"
          onClick={() => setIsLocationSelectorOpen(true)}
          disabled={isEditMode}
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className={selectedLocation ? "font-medium" : "text-muted-foreground"}>
              {selectedLocation ? selectedLocation.name : "Select Location"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>

         {/* Search Bar */}
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
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => updateUrl("date", e.target.value)}
            className="w-auto"
            disabled={isEditMode}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        {selectedLocation && locationItems.length > 0 && (
          <>
            {!isEditMode ? (
              <Button onClick={handleUpdateStock}>
                <Pencil className="h-4 w-4 mr-2" />
                Update Stock
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
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

      {/* Items Table */}
      <div className="flex-1 overflow-auto bg-white">
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
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead className="font-semibold pl-4">Item</TableHead>
                <TableHead className="font-semibold text-center w-[150px]">Available Unit</TableHead>
                <TableHead className="font-semibold text-center w-[150px]">Available Package</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <TableRow key={item._id}>
                  <TableCell className="font-medium pl-4">{item.item}</TableCell>
                  <TableCell className="text-center">
                    {isEditMode ? (
                      <Input
                        type="number"
                        min="0"
                        value={getDisplayValue(item._id, "countedUnit")}
                        onChange={(e) => handleValueChange(item._id, "countedUnit", parseInt(e.target.value) || 0)}
                        className="w-20 mx-auto text-center h-8"
                      />
                    ) : (
                      <span>{item.countedUnit}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditMode ? (
                      <Input
                        type="number"
                        min="0"
                        value={getDisplayValue(item._id, "countedPackage")}
                        onChange={(e) => handleValueChange(item._id, "countedPackage", parseInt(e.target.value) || 0)}
                        className="w-20 mx-auto text-center h-8"
                      />
                    ) : (
                      <span>{item.countedPackage}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
