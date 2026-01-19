
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useEffect, useState, Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, Search, Check, X, Save, ChevronLeft, ChevronRight, Layers, Utensils } from "lucide-react";
import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronsUpDown } from "lucide-react"

type Item = {
  _id: string;
  item: string;
  category: string;
  subCategory: string;
  isDailyCount?: boolean;
  cookingQty?: string;
  costPerPackage: number;
  package: string;
  restockPackageQty: number;
  defaultKingRoomQty: number;
  defaultDoubleQueenQty: number;
  totalUnit?: number;
  totalPackage?: number;
  isBundle?: boolean;
  bundleItems?: { item: string; quantity: number }[];
};

function ItemCombobox({ 
  value, 
  onChange, 
  items, 
  disabledItems = [] 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  items: Item[],
  disabledItems?: string[]
}) {
  const [open, setOpen] = useState(false)
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value
            ? items.find((item) => item._id === value)?.item
            : "Select Item"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search item..." />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item._id}
                  value={item.item}
                  disabled={disabledItems.includes(item._id)}
                  onSelect={() => {
                    onChange(item._id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item._id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.item}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )

}

function CreatableCombobox({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select..." 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: string[],
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  
  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );
  
  const showCreate = search && !filteredOptions.includes(search) && !options.includes(search);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-2 px-2 text-sm">
                {showCreate ? (
                    <div 
                        className="flex items-center gap-2 cursor-pointer p-2 rounded-sm hover:bg-accent"
                        onClick={() => {
                            onChange(search);
                            setOpen(false);
                            setSearch("");
                        }}
                    >
                        <Plus className="h-4 w-4" />
                        Create "{search}"
                    </div>
                ) : (
                    "No matching found."
                )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.length > 0 && filteredOptions.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

import { useSearchParams } from "next/navigation";

function ItemsContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);
  
  // Quick Edit states
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<Record<string, Partial<Item>>>({});
  const [saveLoading, setSaveLoading] = useState(false);

  // Pagination & Infinite Scroll states
  const [visibleCount, setVisibleCount] = useState(20);
  
  const filteredItems = items.filter(item => 
    item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.subCategory && item.subCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.package && item.package.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Unified Infinite Scroll items
  const displayItems = filteredItems.slice(0, visibleCount);
  const desktopObserverTarget = useRef(null);
  const mobileObserverTarget = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(entry => entry.isIntersecting) && visibleCount < filteredItems.length) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1 }
    );

    if (desktopObserverTarget.current) observer.observe(desktopObserverTarget.current);
    if (mobileObserverTarget.current) observer.observe(mobileObserverTarget.current);

    return () => {
      observer.disconnect();
    };
  }, [visibleCount, filteredItems.length]);
  
  // Reset pagination when search changes
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery]);
  
  // Form states
  const [formData, setFormData] = useState({
    item: "",
    category: "",
    subCategory: "",
    costPerPackage: 0,
    package: "",
    restockPackageQty: 0,
    defaultKingRoomQty: 0,
    defaultDoubleQueenQty: 0,
    isBundle: false,
    bundleItems: [] as { item: string; quantity: number }[],
    isDailyCount: false,
    cookingQty: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const router = useRouter();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const [itemsRes, stockRes] = await Promise.all([
        fetch("/api/items"),
        fetch("/api/stock/current")
      ]);
      
      if (itemsRes.ok && stockRes.ok) {
        const itemsData = await itemsRes.json();
        const stockData = await stockRes.json();
        
        // Map stock data to items
        const stockMap = new Map<string, { totalUnit: number; totalPackage: number }>(
          stockData.map((s: any) => [s.item, s])
        );
        
        const itemsWithStock = itemsData.map((item: Item) => ({
          ...item,
          totalUnit: stockMap.get(item._id)?.totalUnit || 0,
          totalPackage: stockMap.get(item._id)?.totalPackage || 0,
        }));
        
        setItems(itemsWithStock);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Open edit dialog if editId is present in URL
  useEffect(() => {
    const editId = searchParams.get("editId");
    if (editId && items.length > 0 && !isDialogOpen && !editingItem) {
      const itemToEdit = items.find(i => i._id === editId);
      if (itemToEdit) {
        handleOpenDialog(itemToEdit);
      }
    }
  }, [searchParams, items, isDialogOpen, editingItem]);

  const updateSearchUrl = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set("q", term);
    } else {
      params.delete("q");
    }
    router.replace(`?${params.toString()}`);
  };

  const handleOpenDialog = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        item: item.item,
        category: item.category,
        subCategory: item.subCategory || "",
        costPerPackage: item.costPerPackage,
        package: item.package || "",
        restockPackageQty: item.restockPackageQty,
        defaultKingRoomQty: item.defaultKingRoomQty,
        defaultDoubleQueenQty: item.defaultDoubleQueenQty,
        isBundle: item.isBundle || false,
        bundleItems: item.bundleItems ? item.bundleItems.map(b => ({
          item: typeof b.item === 'object' ? (b.item as any)._id : b.item, 
          quantity: b.quantity 
        })) : [],
        isDailyCount: item.isDailyCount || false,
        cookingQty: item.cookingQty || "",
      });
    } else {
      setEditingItem(null);
      setFormData({
        item: "",
        category: "",
        subCategory: "",
        costPerPackage: 0,
        package: "",
        restockPackageQty: 0,
        defaultKingRoomQty: 0,
        defaultDoubleQueenQty: 0,
        isBundle: false,
        bundleItems: [],
        isDailyCount: false,
        cookingQty: "",
      });
    }
    setIsDialogOpen(true);
  };


  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormLoading(false);
  };

  const handleAddBundleItem = () => {
    setFormData(prev => ({
      ...prev,
      bundleItems: [...prev.bundleItems, { item: "", quantity: 1 }]
    }));
  };

  const handleRemoveBundleItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      bundleItems: prev.bundleItems.filter((_, i) => i !== index)
    }));
  };

  const handleBundleItemChange = (index: number, field: "item" | "quantity", value: any) => {
    setFormData(prev => {
      const updated = [...prev.bundleItems];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, bundleItems: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      // Clean up payload
      const payload = {
        ...formData,
        bundleItems: formData.isBundle 
          ? formData.bundleItems.filter(bi => bi.item && bi.item !== "")
          : []
      };

      if (editingItem) {
        // Update
        const res = await fetch(`/api/items/${editingItem._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        // Create
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
      }
      await fetchItems();
      handleCloseDialog();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchItems();
    } catch (error) {
       console.error("Error deleting item:", error);
    }
  };

  const handleQuickEditChange = (id: string, field: keyof Item, value: any) => {
    setEditedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const toggleQuickEdit = () => {
    if (isQuickEditMode) {
      // Cancel
      setIsQuickEditMode(false);
      setEditedItems({});
    } else {
      setIsQuickEditMode(true);
    }
  };

  const saveQuickEdit = async () => {
    const updates = Object.entries(editedItems).map(([id, changes]) => ({
      _id: id,
      ...changes
    }));

    if (updates.length === 0) {
      setIsQuickEditMode(false);
      return;
    }

    setSaveLoading(true);
    try {
      const res = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates }),
      });

      if (!res.ok) throw new Error("Failed to update items");
      
      await fetchItems();
      setIsQuickEditMode(false);
      setEditedItems({});
    } catch (error) {
      console.error("Error updating items:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="w-full h-full p-0 flex flex-col">
      <Card className="border-none shadow-none bg-transparent rounded-none flex-1 overflow-hidden mb-20 md:mb-0 p-0 gap-0">
        <CardContent className="px-0 py-0 h-full">
          <div className="border-0 bg-transparent h-full">
            {/* Desktop Table View */}
            <div className="hidden md:flex flex-col h-full bg-white overflow-hidden">
              {/* Route Header (Search & Actions) - Approx 5-6% */}
              <div className="flex-none h-[6%] min-h-[50px] border-b flex items-center justify-between gap-4 px-4 bg-white z-20">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-primary hover:underline">Home</Link>
                  <ChevronRight className="h-4 w-4" />
                  <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
                  <ChevronRight className="h-4 w-4" />
                  <span className="font-medium text-foreground">Items</span>
                </div>
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search items..."
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      updateSearchUrl(e.target.value);
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {isQuickEditMode ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={toggleQuickEdit}
                        disabled={saveLoading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={saveQuickEdit}
                        disabled={saveLoading}
                        className="bg-green-600 hover:bg-green-700 text-white h-9"
                      >
                        {saveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={toggleQuickEdit}
                      className="h-9"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Quick Edit
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleOpenDialog()} className="h-9">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>

              {/* Table Area (Table + Pagination) - Remaining Space (~94%) */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Scrollable Table Container */}
                <div className="flex-1 overflow-auto relative">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="w-[300px] font-semibold pl-4 bg-white">Item</TableHead>
                        <TableHead className="font-semibold bg-white">Category</TableHead>
                        <TableHead className="font-semibold bg-white">Sub Category</TableHead>
                        <TableHead className="font-semibold bg-white">Cost/Pkg</TableHead>
                        <TableHead className="font-semibold bg-white">Package</TableHead>
                        {!isQuickEditMode && (
                          <>
                            <TableHead className="font-semibold text-center text-blue-600 bg-white">Total Unit</TableHead>
                            <TableHead className="font-semibold text-center text-blue-600 bg-white">Total Package</TableHead>
                          </>
                        )}
                        <TableHead className="font-semibold text-center bg-white">Restock Qty</TableHead>
                        <TableHead className="font-semibold text-center bg-white">King Qty</TableHead>
                        <TableHead className="font-semibold text-center bg-white">Dbl Queen Qty</TableHead>
                        <TableHead className="w-[50px] bg-white"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={isQuickEditMode ? 8 : 10} className="h-24 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : displayItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isQuickEditMode ? 8 : 10} className="h-24 text-center text-muted-foreground">
                            No items found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayItems.map((item) => (
                          <TableRow 
                            key={item._id} 
                            className={cn(
                              "hover:bg-muted/50 border-b group",
                              !isQuickEditMode && "cursor-pointer"
                            )}
                            onClick={() => !isQuickEditMode && router.push(`/admin/items/${item._id}`)}
                          >
                            <TableCell className="font-medium pl-4 py-1">
                              {isQuickEditMode ? (
                                <Input 
                                  value={editedItems[item._id]?.item ?? item.item} 
                                  onChange={(e) => handleQuickEditChange(item._id, "item", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 w-full text-xs"
                                />
                              ) : (
                                <div className="font-medium hover:underline text-primary flex items-center gap-2">
                                  {item.isBundle && <Layers className="h-3 w-3 text-amber-500" />}
                                  {item.isDailyCount && <Utensils className="h-3 w-3 text-orange-500" />}
                                  {item.item}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-1">
                              {isQuickEditMode ? (
                                <Input 
                                  value={editedItems[item._id]?.category ?? item.category} 
                                  onChange={(e) => handleQuickEditChange(item._id, "category", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 text-xs"
                                  list={`category-list-${item._id}`}
                                />
                              ) : (
                                <Badge variant="secondary" className="font-normal capitalize scale-90 origin-left">
                                  {item.category}
                                </Badge>
                              )}
                              {isQuickEditMode && (
                                <datalist id={`category-list-${item._id}`}>
                                  <option value="Front Desk" />
                                  <option value="Housekeeping" />
                                  <option value="Maintenance" />
                                  <option value="Breakfast" />
                                </datalist>
                              )}
                            </TableCell>
                            <TableCell className="py-1">
                                {isQuickEditMode ? (
                                    <Input 
                                        value={editedItems[item._id]?.subCategory ?? item.subCategory ?? ""} 
                                        onChange={(e) => handleQuickEditChange(item._id, "subCategory", e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-7 text-xs"
                                        placeholder="Sub Category"
                                    />
                                ) : (
                                    item.subCategory || "-"
                                )}
                            </TableCell>
                            <TableCell className="py-1">
                              {isQuickEditMode ? (
                                <Input 
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editedItems[item._id]?.costPerPackage ?? item.costPerPackage} 
                                  onChange={(e) => handleQuickEditChange(item._id, "costPerPackage", parseFloat(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="h-7 w-20 text-xs"
                                />
                              ) : (
                                `$${item.costPerPackage.toFixed(2)}`
                              )}
                            </TableCell>
                            <TableCell className="py-1">
                              {isQuickEditMode ? (
                                <Input 
                                  value={editedItems[item._id]?.package ?? item.package ?? ""} 
                                  onChange={(e) => handleQuickEditChange(item._id, "package", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 w-20 text-xs"
                                />
                              ) : (
                                item.package || "-"
                              )}
                            </TableCell>
                            {!isQuickEditMode && (
                              <>
                                <TableCell className="text-center font-semibold text-blue-600 bg-blue-50/50 py-1">
                                  {item.totalUnit || 0}
                                </TableCell>
                                <TableCell className="text-center font-semibold text-blue-600 bg-blue-50/50 py-1">
                                  {item.totalPackage || 0}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-center py-1">
                              {isQuickEditMode ? (
                                <Input 
                                  type="number"
                                  min="0"
                                  value={editedItems[item._id]?.restockPackageQty ?? item.restockPackageQty} 
                                  onChange={(e) => handleQuickEditChange(item._id, "restockPackageQty", parseInt(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="h-7 w-14 mx-auto text-center text-xs"
                                />
                              ) : (
                                item.restockPackageQty
                              )}
                            </TableCell>
                            <TableCell className="text-center py-1">
                              {isQuickEditMode ? (
                                <Input 
                                  type="number"
                                  min="0"
                                  value={editedItems[item._id]?.defaultKingRoomQty ?? item.defaultKingRoomQty} 
                                  onChange={(e) => handleQuickEditChange(item._id, "defaultKingRoomQty", parseInt(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="h-7 w-14 mx-auto text-center text-xs"
                                />
                              ) : (
                                item.defaultKingRoomQty
                              )}
                            </TableCell>
                            <TableCell className="text-center py-1">
                              {isQuickEditMode ? (
                                <Input 
                                  type="number"
                                  min="0"
                                  value={editedItems[item._id]?.defaultDoubleQueenQty ?? item.defaultDoubleQueenQty} 
                                  onChange={(e) => handleQuickEditChange(item._id, "defaultDoubleQueenQty", parseInt(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="h-7 w-14 mx-auto text-center text-xs"
                                />
                              ) : (
                                item.defaultDoubleQueenQty
                              )}
                            </TableCell>
                            <TableCell className="py-1">
                              {!isQuickEditMode && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/admin/items/${item._id}`); }}>
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDialog(item); }}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-red-600 focus:text-red-600"
                                      onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </table>

                  {/* Sentinel inside scroll container */}
                  <div ref={desktopObserverTarget} className="h-4 w-full" />
                  {visibleCount < filteredItems.length && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Footer with Count Summary */}
                {!loading && filteredItems.length > 0 && (
                  <div className="flex-none flex items-center justify-between p-2 border-t bg-white z-20">
                    <div className="text-sm text-muted-foreground">
                      Showing {displayItems.length} of {filteredItems.length} entries
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col h-full">
              <div className="p-4 border-b bg-white">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search items..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-4 p-4 pb-24 overflow-auto flex-1">
              {loading ? (
                 <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                 </div>
              ) : displayItems.length === 0 ? (
                 <div className="text-center text-muted-foreground py-8">
                   No items found.
                 </div>
              ) : (
                 <>
                {displayItems.map((item) => (
                  <Card key={item._id} className="bg-white shadow-sm border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                       <div>
                         <CardTitle 
                            className="text-base font-bold cursor-pointer hover:underline text-primary"
                            onClick={() => setViewingItem(item)}
                         >
                           {item.item}
                         </CardTitle>
                         {item.subCategory && (
                            <div className="text-xs text-muted-foreground">{item.subCategory}</div>
                         )}
                       </div>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 -mr-2">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingItem(item)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenDialog(item)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDelete(item._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4">
                      <div className="flex flex-col gap-2 text-sm mt-2">
                        <div className="flex justify-between items-center">
                           <span className="text-muted-foreground font-medium">Category</span>
                           <span>{item.category}</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-muted-foreground font-medium">Cost/Pkg</span>
                           <span>${item.costPerPackage.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-muted-foreground font-medium">Package</span>
                           <span>{item.package || "-"}</span>
                        </div>
                         <div className="flex justify-between items-center">
                           <span className="text-blue-600 font-semibold">Total Unit</span>
                           <span className="text-blue-600 font-bold">{item.totalUnit || 0}</span>
                        </div>
                         <div className="flex justify-between items-center">
                           <span className="text-blue-600 font-semibold">Total Pkg</span>
                           <span className="text-blue-600 font-bold">{item.totalPackage || 0}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t text-xs">
                          <div className="flex flex-col items-center">
                            <span className="text-muted-foreground uppercase text-[10px]">Restock</span>
                            <span className="font-medium">{item.restockPackageQty}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-muted-foreground uppercase text-[10px]">King</span>
                            <span className="font-medium">{item.defaultKingRoomQty}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-muted-foreground uppercase text-[10px]">Dbl Queen</span>
                            <span className="font-medium">{item.defaultDoubleQueenQty}</span>
                          </div>
                        </div>

                         {item.isBundle && (
                            <div className="mt-2 pt-2 border-t bg-amber-50 -mx-6 px-6 pb-2">
                                 <div className="font-semibold text-xs text-amber-700 flex items-center gap-1 mt-2 mb-2">
                                    <Layers className="h-3 w-3" /> Bundle Includes:
                                </div>
                                 <div className="space-y-1">
                                    {item.bundleItems?.length === 0 ? (
                                        <div className="text-xs text-muted-foreground italic">No items</div>
                                    ) : (
                                        item.bundleItems?.map((bi, idx) => {
                                            const itemName = typeof bi.item === 'object' ? (bi.item as any).item : "Unknown Item";
                                            return (
                                                <div key={idx} className="flex justify-between text-xs items-center">
                                                     <span className="text-foreground">{itemName}</span>
                                                     <Badge variant="outline" className="h-5 px-1.5 font-normal bg-white">
                                                        x{bi.quantity}
                                                     </Badge>
                                                </div>
                                            )
                                        })
                                    )}
                                 </div>
                            </div>
                         )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {/* Sentinel for Infinite Scroll */}
                <div ref={mobileObserverTarget} className="h-4 w-full" />
                {visibleCount < filteredItems.length && (
                   <div className="flex justify-center py-4">
                     <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                   </div>
                )}
                </>
              )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription className="hidden">
              Form
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label htmlFor="item">Item Name</Label>
                 <Input
                   id="item"
                   value={formData.item}
                   onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                   required
                 />
               </div>
               <div className="grid gap-2">
                 <Label htmlFor="category">Category</Label>
                 <CreatableCombobox
                   value={formData.category}
                   onChange={(val) => setFormData({ ...formData, category: val })}
                   options={Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort()}
                   placeholder="Select Category"
                 />
               </div>
               <div className="grid gap-2">
                 <Label htmlFor="subCategory">Sub Category</Label>
                 <CreatableCombobox
                   value={formData.subCategory}
                   onChange={(val) => setFormData({ ...formData, subCategory: val })}
                   options={Array.from(new Set(items.map(i => i.subCategory).filter(Boolean))).sort()}
                   placeholder="Select Sub Category"
                 />
               </div>
               <div className="grid gap-2">
                 <Label htmlFor="package">Package</Label>
                 <Input
                   id="package"
                   placeholder="e.g. Box of 10"
                   value={formData.package}
                   onChange={(e) => setFormData({ ...formData, package: e.target.value })}
                 />
               </div>
            <div className="flex items-center space-x-2 border-t pt-4 col-span-1 sm:col-span-2">
               <input
                 type="checkbox"
                 id="isBundle"
                 className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                 checked={formData.isBundle}
                 onChange={(e) => setFormData({ ...formData, isBundle: e.target.checked })}
               />
               <Label htmlFor="isBundle" className="font-medium cursor-pointer">
                 Is this a Bundle?
               </Label>
            </div>

            {formData.isBundle && (
              <div className="border rounded-md p-4 bg-muted/30 space-y-4 col-span-1 sm:col-span-2">
                 <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Bundle Components</h4>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddBundleItem}>
                      <Plus className="h-3 w-3 mr-1" /> Add Component
                    </Button>
                 </div>
                 
                 {formData.bundleItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No components added to this bundle yet.
                    </p>
                 ) : (
                   <div className="space-y-3">
                     {formData.bundleItems.map((bundleItem, index) => (
                       <div key={index} className="flex items-end gap-3">
                          <div className="flex-1 space-y-1">
                             <Label className="text-xs">Item</Label>
                             <ItemCombobox
                               value={bundleItem.item}
                               onChange={(val) => handleBundleItemChange(index, "item", val)}
                               items={items.filter(i => i._id !== editingItem?._id)} // Prevent self-selection
                               disabledItems={
                                 formData.bundleItems
                                   .map(bi => bi.item)
                                   .filter((id, i) => i !== index) // Disable items already selected in other rows
                               }
                             />
                          </div>
                          <div className="w-24 space-y-1">
                             <Label className="text-xs">Quantity</Label>
                             <Input
                               type="number"
                               min="1"
                               value={bundleItem.quantity}
                               onChange={(e) => handleBundleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                               required
                             />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 h-9 w-9 mb-[2px]"
                            onClick={() => handleRemoveBundleItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            )}

            <div className="flex items-center space-x-2 border-t pt-4">
               <input
                 type="checkbox"
                 id="isDailyCount"
                 className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                 checked={formData.isDailyCount || false}
                 onChange={(e) => setFormData({ ...formData, isDailyCount: e.target.checked })}
               />
               <Label htmlFor="isDailyCount" className="font-medium cursor-pointer">
                 Show in Daily Occupancy?
               </Label>
            </div>

            {formData.isDailyCount && (
                <div className="grid gap-2 border bg-muted/20 p-3 rounded-md">
                    <Label htmlFor="cookingQty">Cooking Quantity (e.g. "1 tray = 1 bag")</Label>
                    <Input
                        id="cookingQty"
                        value={formData.cookingQty || ""}
                        onChange={(e) => setFormData({ ...formData, cookingQty: e.target.value })}
                        placeholder="Optional description"
                    />
                </div>
            )}

               <div className="grid gap-2">
                 <Label htmlFor="costPerPackage">Cost Per Package ($)</Label>
                 <Input
                   id="costPerPackage"
                   type="number"
                   step="0.01"
                   min="0"
                   value={formData.costPerPackage}
                   onChange={(e) => setFormData({ ...formData, costPerPackage: parseFloat(e.target.value) || 0 })}
                   required
                 />
               </div>
               <div className="grid gap-2">
                 <Label htmlFor="restockPackageQty">Restock Pkg Qty</Label>
                 <Input
                   id="restockPackageQty"
                   type="number"
                   min="0"
                   value={formData.restockPackageQty}
                   onChange={(e) => setFormData({ ...formData, restockPackageQty: parseInt(e.target.value) || 0 })}
                   required
                 />
               </div>
               <div className="grid gap-2">
                 <Label htmlFor="defaultKingRoomQty">Default King Room Qty</Label>
                 <Input
                   id="defaultKingRoomQty"
                   type="number"
                   min="0"
                   value={formData.defaultKingRoomQty}
                   onChange={(e) => setFormData({ ...formData, defaultKingRoomQty: parseInt(e.target.value) || 0 })}
                   required
                 />
               </div>
               <div className="grid gap-2">
                 <Label htmlFor="defaultDoubleQueenQty">Default Dbl Queen Qty</Label>
                 <Input
                   id="defaultDoubleQueenQty"
                   type="number"
                   min="0"
                   value={formData.defaultDoubleQueenQty}
                   onChange={(e) => setFormData({ ...formData, defaultDoubleQueenQty: parseInt(e.target.value) || 0 })}
                   required
                 />
               </div>
            </div>
            
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Saving...
                   </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* View Item Details Dialog */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Item Name</h4>
                  <p className="font-semibold">{viewingItem.item}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Category</h4>
                  <p>{viewingItem.category}</p>
                </div>
                {viewingItem.subCategory && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-muted-foreground">Sub Category</h4>
                    <p>{viewingItem.subCategory}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Cost Per Package</h4>
                  <p>${viewingItem.costPerPackage.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Package Type</h4>
                  <p>{viewingItem.package || "-"}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Restock Qty</h4>
                  <p>{viewingItem.restockPackageQty}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Default King Qty</h4>
                  <p>{viewingItem.defaultKingRoomQty}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Default Queen Qty</h4>
                  <p>{viewingItem.defaultDoubleQueenQty}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingItem(null)}>Close</Button>
            <Button variant="outline" onClick={() => {
                setViewingItem(null);
                handleOpenDialog(viewingItem!);
            }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ItemsContent />
    </Suspense>
  );
}
