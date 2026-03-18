"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Loader2, Calendar, Save, ChevronRight, Search, ChevronLeft,
  ArrowRightLeft, Package, MapPin, ChevronDown, CheckCircle2,
  ArrowRight, AlertCircle, Truck
} from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";

type Location = {
  _id: string;
  name: string;
  description?: string;
  inventoryType?: string;
  category?: string;
  items?: string[];
  isPurchaseLocation?: boolean;
};

type Item = {
  _id: string;
  item: string;
  package?: string;
  category?: string;
};

type ItemWithStock = Item & {
  currentUnit: number;
  currentPackage: number;
};

type TransferValues = {
  [itemId: string]: {
    transferUnit: number | string;
    transferPackage: number | string;
  };
};

const getPackageSize = (packageStr?: string): number => {
  if (!packageStr) return 1;
  const match = packageStr.match(/(\d+)/);
  return match ? parseInt(match[0], 10) : 1;
};

function StockTransferContent() {
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fromLocation, setFromLocation] = useState<Location | null>(null);
  const [toLocation, setToLocation] = useState<Location | null>(null);
  const [isFromSelectorOpen, setIsFromSelectorOpen] = useState(false);
  const [isToSelectorOpen, setIsToSelectorOpen] = useState(false);
  const [transferValues, setTransferValues] = useState<TransferValues>({});
  const [sourceItems, setSourceItems] = useState<ItemWithStock[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [transferCount, setTransferCount] = useState(0);
  const { toast } = useToast();

  // Scroll / Pagination state
  const [visibleCount, setVisibleCount] = useState(20);
  const observerTarget = useRef(null);

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

  const updateUrl = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
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
    const [year, month, day] = selectedDate.split('-').map(Number);
    const currentDate = new Date(Date.UTC(year, month - 1, day - 1));
    const newDateStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
    updateUrl("date", newDateStr);
  };

  const handleNextDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const currentDate = new Date(Date.UTC(year, month - 1, day + 1));
    const newDateStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
    updateUrl("date", newDateStr);
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
      await Promise.all([fetchLocations(), fetchItems()]);

      // Set date in URL if not present
      const params = new URLSearchParams(window.location.search);
      if (!params.get("date")) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        params.set("date", `${year}-${month}-${day}`);
        router.replace(`${pathname}?${params.toString()}`);
      }

      setLoading(false);
    };
    loadData();
  }, []);

  // Reset visible count on search or location change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, fromLocation, toLocation]);

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

  // Fetch source items when FROM location, TO location, or date changes
  // Items are filtered based on the DESTINATION (To) location's associated items
  useEffect(() => {
    if (!fromLocation || !toLocation || !selectedDate || allItems.length === 0) return;

    setTransferValues({});

    const fetchSourceStock = async () => {
      try {
        setLoadingItems(true);
        const params = new URLSearchParams({
          date: selectedDate,
          location: fromLocation._id,
        });

        const response = await fetch(`/api/stock/combined?${params}`);
        const data = await response.json();

        // Filter items based on the DESTINATION (To) location's associated items
        let filteredItems: Item[];
        if (toLocation.isPurchaseLocation) {
          // If destination is a Purchase Location, show all items
          filteredItems = allItems;
        } else {
          const destinationItemIds = toLocation.items || [];
          filteredItems = allItems.filter(item => destinationItemIds.includes(item._id));
        }

        const openingMap = data.openingBalances || {};
        const transMap = data.transactions || {};

        const mappedItems: ItemWithStock[] = filteredItems.map(item => {
          const rawOpeningUnit = openingMap[item._id]?.unit || 0;
          const rawOpeningPkg = openingMap[item._id]?.package || 0;

          const pkgSize = getPackageSize(item.package);
          let openingUnit = rawOpeningUnit;
          let openingPackage = rawOpeningPkg;

          if (pkgSize > 1) {
            const total = rawOpeningUnit + (rawOpeningPkg * pkgSize);
            openingPackage = Math.floor(total / pkgSize);
            openingUnit = total % pkgSize;
          }

          // Current stock = opening + purchases - consumed (today)
          const purchasedUnit = transMap[item._id]?.purchasedUnit || 0;
          const purchasedPackage = transMap[item._id]?.purchasedPackage || 0;
          const consumedUnit = transMap[item._id]?.consumedUnit || 0;
          const consumedPackage = transMap[item._id]?.consumedPackage || 0;

          return {
            ...item,
            currentUnit: (() => {
              const rawUnit = openingUnit + purchasedUnit - consumedUnit;
              const rawPkg = openingPackage + purchasedPackage - consumedPackage;
              if (pkgSize > 1) {
                const total = (rawPkg * pkgSize) + rawUnit;
                return total % pkgSize;
              }
              return rawUnit;
            })(),
            currentPackage: (() => {
              const rawUnit = openingUnit + purchasedUnit - consumedUnit;
              const rawPkg = openingPackage + purchasedPackage - consumedPackage;
              if (pkgSize > 1) {
                const total = (rawPkg * pkgSize) + rawUnit;
                return Math.floor(total / pkgSize);
              }
              return rawPkg;
            })(),
          };
        }).filter(item => item.currentUnit > 0 || item.currentPackage > 0);

        setSourceItems(mappedItems);
      } catch (error) {
        console.error("Error fetching source stock:", error);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchSourceStock();
  }, [fromLocation, toLocation, selectedDate, allItems]);

  const handleFromLocationSelect = (location: Location) => {
    setFromLocation(location);
    setIsFromSelectorOpen(false);
    // Clear to location if same
    if (toLocation && toLocation._id === location._id) {
      setToLocation(null);
    }
  };

  const handleToLocationSelect = (location: Location) => {
    setToLocation(location);
    setIsToSelectorOpen(false);
  };

  const handleTransferValueChange = (itemId: string, field: "transferUnit" | "transferPackage", value: number | string) => {
    setTransferValues(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };

  const getTransferValue = (itemId: string, field: "transferUnit" | "transferPackage") => {
    return transferValues[itemId]?.[field] ?? "";
  };

  // Returns true if transfer quantity exceeds available stock for an item
  const isTransferExceedingStock = (item: ItemWithStock): boolean => {
    const transferPkg = Number(getTransferValue(item._id, "transferPackage") || 0);
    const transferUnit = Number(getTransferValue(item._id, "transferUnit") || 0);
    if (transferPkg === 0 && transferUnit === 0) return false;

    const pkgSize = getPackageSize(item.package);
    const totalAvailable = (item.currentPackage * pkgSize) + item.currentUnit;
    const totalTransfer = (transferPkg * pkgSize) + transferUnit;
    return totalTransfer > totalAvailable;
  };

  const getItemsToTransfer = () => {
    return Object.entries(transferValues).filter(([itemId, val]) => {
      const unit = val.transferUnit === "" ? 0 : Number(val.transferUnit);
      const pkg = val.transferPackage === "" ? 0 : Number(val.transferPackage);
      return unit > 0 || pkg > 0;
    });
  };

  const handleTransfer = async () => {
    if (!fromLocation || !toLocation) {
      toast({ variant: "destructive", title: "Error", description: "Please select both source and destination locations." });
      return;
    }

    const itemsToTransfer = getItemsToTransfer();
    if (itemsToTransfer.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter transfer quantities for at least one item." });
      return;
    }

    // Validate no transfer exceeds available stock
    const overStockedItems = sourceItems.filter(item => isTransferExceedingStock(item));
    if (overStockedItems.length > 0) {
      const itemNames = overStockedItems.map(i => i.item).join(", ");
      toast({ variant: "destructive", title: "Exceeds Available Stock", description: `Transfer quantity exceeds available stock for: ${itemNames}` });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          fromLocation: fromLocation._id,
          toLocation: toLocation._id,
          items: itemsToTransfer.map(([itemId, val]) => ({
            itemId,
            transferUnit: val.transferUnit === "" ? 0 : Number(val.transferUnit),
            transferPackage: val.transferPackage === "" ? 0 : Number(val.transferPackage),
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to transfer stock");
      }

      setTransferCount(itemsToTransfer.length);
      setSuccessDialog(true);
      setTransferValues({});

      // Refresh source items
      const params = new URLSearchParams({
        date: selectedDate,
        location: fromLocation._id,
      });

      const refreshResponse = await fetch(`/api/stock/combined?${params}`);
      const refreshData = await refreshResponse.json();

      // Filter items based on the DESTINATION (To) location's associated items
      let filteredItems: Item[];
      if (toLocation.isPurchaseLocation) {
        filteredItems = allItems;
      } else {
        const destinationItemIds = toLocation.items || [];
        filteredItems = allItems.filter(item => destinationItemIds.includes(item._id));
      }

      const openingMap = refreshData.openingBalances || {};
      const transMap = refreshData.transactions || {};

      const mappedItems: ItemWithStock[] = filteredItems.map(item => {
        const rawOpeningUnit = openingMap[item._id]?.unit || 0;
        const rawOpeningPkg = openingMap[item._id]?.package || 0;

        const pkgSize = getPackageSize(item.package);
        let openingUnit = rawOpeningUnit;
        let openingPackage = rawOpeningPkg;

        if (pkgSize > 1) {
          const total = rawOpeningUnit + (rawOpeningPkg * pkgSize);
          openingPackage = Math.floor(total / pkgSize);
          openingUnit = total % pkgSize;
        }

        const purchasedUnit = transMap[item._id]?.purchasedUnit || 0;
        const purchasedPackage = transMap[item._id]?.purchasedPackage || 0;
        const consumedUnit = transMap[item._id]?.consumedUnit || 0;
        const consumedPackage = transMap[item._id]?.consumedPackage || 0;

        return {
          ...item,
          currentUnit: (() => {
            const rawUnit = openingUnit + purchasedUnit - consumedUnit;
            const rawPkg = openingPackage + purchasedPackage - consumedPackage;
            if (pkgSize > 1) {
              const total = (rawPkg * pkgSize) + rawUnit;
              return total % pkgSize;
            }
            return rawUnit;
          })(),
          currentPackage: (() => {
            const rawUnit = openingUnit + purchasedUnit - consumedUnit;
            const rawPkg = openingPackage + purchasedPackage - consumedPackage;
            if (pkgSize > 1) {
              const total = (rawPkg * pkgSize) + rawUnit;
              return Math.floor(total / pkgSize);
            }
            return rawPkg;
          })(),
        };
      }).filter(item => item.currentUnit > 0 || item.currentPackage > 0);

      setSourceItems(mappedItems);

    } catch (error: any) {
      console.error("Error transferring stock:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to transfer stock." });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = sourceItems.filter(item =>
    item.item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedItems = filteredItems.slice(0, visibleCount);
  const itemsToTransferCount = getItemsToTransfer().length;

  // Available "To" locations exclude the "From" location
  const availableToLocations = allLocations.filter(l => l._id !== fromLocation?._id);

  const formatStockDisplay = (pkg: number, unit: number, pkgStr?: string) => {
    const pkgSize = getPackageSize(pkgStr);
    const hasPkg = !!pkgStr && pkgStr !== "0" && pkgSize > 1;
    if (!hasPkg) return `${unit}`;
    const total = (pkg * pkgSize) + unit;
    return `${pkg} / ${unit} (${total})`;
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Controls */}
      <div className="border-b bg-white px-4 py-3">
        <div className="flex flex-col gap-3">
          {/* Breadcrumbs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-primary hover:underline">Home</Link>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground">Transfer Stock</span>
            </div>
            {/* Date Controls */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevDay}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={dateInputValue}
                  onChange={handleDateChange}
                  className="w-[160px] pl-8 h-8 text-xs"
                />
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextDay}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Transfer Direction */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* FROM Location */}
            <Button
              variant="outline"
              className="h-10 justify-between text-left min-w-[160px] lg:min-w-[200px] border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-50"
              onClick={() => setIsFromSelectorOpen(true)}
            >
              <div className="flex items-center gap-2 truncate">
                <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Package className="h-3.5 w-3.5 text-orange-600" />
                </div>
                <div className="truncate">
                  <p className="text-[10px] text-orange-500 font-medium leading-none mb-0.5">FROM</p>
                  <p className={`text-xs truncate ${fromLocation ? "font-semibold text-orange-700" : "text-muted-foreground"}`}>
                    {fromLocation ? fromLocation.name : "Select Source"}
                  </p>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            </Button>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-orange-500 to-teal-500 flex items-center justify-center shadow-md">
                <ArrowRight className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* TO Location */}
            <Button
              variant="outline"
              className="h-10 justify-between text-left min-w-[160px] lg:min-w-[200px] border-2 border-teal-200 bg-teal-50/50 hover:bg-teal-50"
              onClick={() => setIsToSelectorOpen(true)}
              disabled={!fromLocation}
            >
              <div className="flex items-center gap-2 truncate">
                <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <div className="truncate">
                  <p className="text-[10px] text-teal-500 font-medium leading-none mb-0.5">TO</p>
                  <p className={`text-xs truncate ${toLocation ? "font-semibold text-teal-700" : "text-muted-foreground"}`}>
                    {toLocation ? toLocation.name : "Select Destination"}
                  </p>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-teal-400 shrink-0" />
            </Button>

            <div className="flex-1" />

            {/* Search */}
            {fromLocation && (
              <div className="relative w-48 xl:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search items..."
                  className="w-full pl-8 h-8 text-xs"
                  value={searchQuery}
                  onChange={(e) => updateUrl("q", e.target.value)}
                />
              </div>
            )}

            {/* Transfer Button */}
            {fromLocation && toLocation && itemsToTransferCount > 0 && (
              <Button
                onClick={handleTransfer}
                disabled={saving}
                className="h-10 bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-600 hover:to-teal-600 text-white shadow-lg px-6 gap-2 font-semibold"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4" />
                )}
                Transfer {itemsToTransferCount} {itemsToTransferCount === 1 ? "Item" : "Items"}
              </Button>
            )}
          </div>
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
                  <div className="h-16 bg-orange-50 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        ) : !fromLocation ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="relative mb-6">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-orange-100 to-teal-100 flex items-center justify-center">
                <ArrowRightLeft className="h-12 w-12 text-orange-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-teal-500 flex items-center justify-center shadow-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800 mb-2">Transfer Stock Between Locations</p>
            <p className="text-sm text-gray-500 max-w-md text-center">
              Select a source location to view available stock, then choose a destination and enter transfer quantities.
            </p>
            <Button 
              className="mt-6 bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-600 hover:to-teal-600 text-white shadow-lg gap-2 px-8 h-12 text-base"
              onClick={() => setIsFromSelectorOpen(true)}
            >
              <Package className="h-5 w-5" />
              Select Source Location
            </Button>
          </div>
        ) : !toLocation ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-teal-100 flex items-center justify-center mb-4">
              <MapPin className="h-10 w-10 text-teal-400" />
            </div>
            <p className="text-xl font-bold text-gray-800 mb-2">Select Destination</p>
            <p className="text-sm text-gray-500">Choose where you want to transfer stock from <strong>{fromLocation.name}</strong></p>
            <Button 
              className="mt-6 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-lg gap-2 px-8 h-12 text-base"
              onClick={() => setIsToSelectorOpen(true)}
            >
              <MapPin className="h-5 w-5" />
              Select Destination Location
            </Button>
          </div>
        ) : loadingItems ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-orange-50 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        ) : sourceItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4 text-amber-400" />
            <p className="text-lg font-medium text-gray-800">No Stock Available</p>
            <p className="text-sm">No items with available stock found in <strong>{fromLocation.name}</strong></p>
          </div>
        ) : (
          <>
            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayedItems.map((item) => {
                const hasPkg = !!item.package && item.package !== "0" && getPackageSize(item.package) > 1;
                const currentStockDisplay = formatStockDisplay(item.currentPackage, item.currentUnit, item.package);
                const exceedsStock = isTransferExceedingStock(item);

                return (
                  <div key={item._id} className={`bg-white rounded-xl shadow-sm border p-4 space-y-3 ${exceedsStock ? "border-red-300 bg-red-50/30" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-base">{item.item}</span>
                      {exceedsStock && (
                        <span className="text-[10px] text-red-500 font-semibold bg-red-100 px-2 py-0.5 rounded-full">Exceeds stock</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Available Stock */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Available</p>
                        <p className="text-lg font-bold text-gray-700">{currentStockDisplay}</p>
                      </div>

                      {/* Transfer Quantity */}
                      <div className={`rounded-lg p-3 border ${exceedsStock ? "bg-gradient-to-br from-red-50 to-red-100 border-red-200" : "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100"}`}>
                        <p className={`text-xs mb-1 font-medium ${exceedsStock ? "text-red-600" : "text-orange-600"}`}>Transfer Qty</p>
                        <div className="flex items-center gap-1">
                          {hasPkg && (
                            <Input
                              type="number"
                              min="0"
                              placeholder="Pkg"
                              value={getTransferValue(item._id, "transferPackage")}
                              onChange={(e) => handleTransferValueChange(item._id, "transferPackage", parseInt(e.target.value) || 0)}
                              className={`h-9 text-sm font-bold text-center flex-1 ${exceedsStock ? "border-red-300 focus-visible:ring-red-400 bg-red-50" : "border-orange-200 focus-visible:ring-orange-400"}`}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            />
                          )}
                          {hasPkg && <span className="text-gray-400 text-sm">/</span>}
                          <Input
                            type="number"
                            min="0"
                            placeholder="Unit"
                            value={getTransferValue(item._id, "transferUnit")}
                            onChange={(e) => handleTransferValueChange(item._id, "transferUnit", parseInt(e.target.value) || 0)}
                            className={`h-9 text-sm font-bold text-center flex-1 ${exceedsStock ? "border-red-300 focus-visible:ring-red-400 bg-red-50" : "border-orange-200 focus-visible:ring-orange-400"}`}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        </div>
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
                    <TableHead className="font-semibold text-center w-[120px]">Package</TableHead>
                    <TableHead className="font-semibold text-center w-[180px] bg-gray-50/50">Available Stock</TableHead>
                    <TableHead className="font-semibold text-center w-[220px] bg-gradient-to-r from-orange-50/50 to-amber-50/50">
                      <div className="flex items-center justify-center gap-1.5">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-orange-500" />
                        Transfer Quantity
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedItems.map((item) => {
                    const hasPkg = !!item.package && item.package !== "0" && getPackageSize(item.package) > 1;
                    const currentStockDisplay = formatStockDisplay(item.currentPackage, item.currentUnit, item.package);
                    const hasTransferValue = (() => {
                      const u = Number(getTransferValue(item._id, "transferUnit") || 0);
                      const p = Number(getTransferValue(item._id, "transferPackage") || 0);
                      return u > 0 || p > 0;
                    })();
                    const exceedsStock = isTransferExceedingStock(item);

                    return (
                      <TableRow key={item._id} className={exceedsStock ? "bg-red-50/50" : hasTransferValue ? "bg-orange-50/30" : ""}>
                        <TableCell className="font-medium pl-4">
                          <div className="flex items-center gap-2">
                            {exceedsStock ? (
                              <div className="h-2 w-2 rounded-full bg-red-500" />
                            ) : hasTransferValue ? (
                              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                            ) : null}
                            {item.item}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-gray-500">
                          {item.package || "-"}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-gray-700 bg-gray-50/30">
                          {currentStockDisplay}
                        </TableCell>
                        <TableCell className="text-center bg-gradient-to-r from-orange-50/20 to-amber-50/20">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 justify-center">
                              {hasPkg && (
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Pkg"
                                  value={getTransferValue(item._id, "transferPackage")}
                                  onChange={(e) => handleTransferValueChange(item._id, "transferPackage", e.target.value)}
                                  className={`w-16 mx-auto text-center h-8 ${exceedsStock ? "border-red-400 focus-visible:ring-red-400 bg-red-50" : "border-orange-200 focus-visible:ring-orange-400"}`}
                                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                />
                              )}
                              {hasPkg && <span className="text-gray-400">/</span>}
                              <Input
                                type="number"
                                min="0"
                                placeholder="Unit"
                                value={getTransferValue(item._id, "transferUnit")}
                                onChange={(e) => handleTransferValueChange(item._id, "transferUnit", e.target.value)}
                                className={`w-16 mx-auto text-center h-8 ${exceedsStock ? "border-red-400 focus-visible:ring-red-400 bg-red-50" : "border-orange-200 focus-visible:ring-orange-400"}`}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              />
                            </div>
                            {exceedsStock && (
                              <span className="text-[10px] text-red-500 font-medium">Exceeds available stock</span>
                            )}
                          </div>
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

      {/* Observer Target for Infinite Scroll */}
      {fromLocation && toLocation && (
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
      )}

      {/* Bottom Bar */}
      {fromLocation && toLocation && sourceItems.length > 0 && (
        <div className="p-3 border-t bg-white flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {displayedItems.length} of {filteredItems.length} available items
          </span>
          {itemsToTransferCount > 0 && (
            <Button
              onClick={handleTransfer}
              disabled={saving}
              className="lg:hidden bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-600 hover:to-teal-600 text-white shadow-lg gap-2 font-semibold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Transfer {itemsToTransferCount}
            </Button>
          )}
        </div>
      )}

      {/* FROM Location Selector Dialog */}
      <Dialog open={isFromSelectorOpen} onOpenChange={setIsFromSelectorOpen}>
        <DialogContent className="sm:max-w-[400px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-orange-600" />
              </div>
              Select Source Location
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allLocations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No locations found.
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {allLocations.map((location) => (
                  <div
                    key={location._id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-orange-50 transition-colors ${
                      fromLocation?._id === location._id ? "bg-orange-100 border border-orange-300" : ""
                    }`}
                    onClick={() => handleFromLocationSelect(location)}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      location.isPurchaseLocation 
                        ? "bg-gradient-to-br from-teal-100 to-teal-200" 
                        : "bg-orange-50"
                    }`}>
                      {location.isPurchaseLocation
                        ? <Package className="h-5 w-5 text-teal-600" />
                        : <MapPin className="h-5 w-5 text-orange-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{location.name}</p>
                        {location.isPurchaseLocation && (
                          <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-semibold uppercase">
                            Purchase
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {location.isPurchaseLocation ? "Central purchase location" : `${location.items?.length || 0} items`}
                      </p>
                    </div>
                    {fromLocation?._id === location._id && (
                      <div className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* TO Location Selector Dialog */}
      <Dialog open={isToSelectorOpen} onOpenChange={setIsToSelectorOpen}>
        <DialogContent className="sm:max-w-[400px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-teal-600" />
              </div>
              Select Destination Location
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {availableToLocations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No other locations available.
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {availableToLocations.map((location) => (
                  <div
                    key={location._id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-teal-50 transition-colors ${
                      toLocation?._id === location._id ? "bg-teal-100 border border-teal-300" : ""
                    }`}
                    onClick={() => handleToLocationSelect(location)}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      location.isPurchaseLocation 
                        ? "bg-gradient-to-br from-teal-100 to-teal-200" 
                        : "bg-teal-50"
                    }`}>
                      {location.isPurchaseLocation
                        ? <Package className="h-5 w-5 text-teal-600" />
                        : <MapPin className="h-5 w-5 text-teal-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{location.name}</p>
                        {location.isPurchaseLocation && (
                          <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-semibold uppercase">
                            Purchase
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {location.isPurchaseLocation ? "Central purchase location" : `${location.items?.length || 0} items`}
                      </p>
                    </div>
                    {toLocation?._id === location._id && (
                      <div className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="sm:max-w-[400px] text-center">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Transfer Complete!</h3>
              <p className="text-sm text-muted-foreground">
                Successfully transferred <strong>{transferCount}</strong> {transferCount === 1 ? "item" : "items"} from{" "}
                <strong className="text-orange-600">{fromLocation?.name}</strong> to{" "}
                <strong className="text-teal-600">{toLocation?.name}</strong>
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setSuccessDialog(false)} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StockTransferPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <StockTransferContent />
    </Suspense>
  );
}
