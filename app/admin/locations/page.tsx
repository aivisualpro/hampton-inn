
"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, X, ChevronRight, ChevronLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";
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
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

function ItemsMultiSelect({ 
  value, 
  onChange, 
  options 
}: { 
  value: string[], 
  onChange: (val: string[]) => void,
  options: { label: string, value: string }[] 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const handleToggle = (itemValue: string) => {
    const isSelected = value.includes(itemValue)
    if (isSelected) {
      onChange(value.filter((v) => v !== itemValue))
    } else {
      onChange([...value, itemValue])
    }
  }

  const filteredOptions = options
    .filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aSelected = value.includes(a.value);
      const bSelected = value.includes(b.value);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.label.localeCompare(b.label);
    });

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className="w-full justify-between h-auto min-h-[40px] py-1 px-3"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value.length > 0 ? (
           <div className="flex flex-wrap gap-1">
             {value.length} items selected
           </div>
        ) : (
          "Select items..."
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {isOpen && (
        <div className="absolute z-50 bottom-full mb-1 w-full bg-popover border border-border rounded-md shadow-lg">
          <div className="p-2 border-b">
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <div 
            className="max-h-[300px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No items found.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer",
                    value.includes(option.value) && "bg-primary/5"
                  )}
                  onClick={() => handleToggle(option.value)}
                >
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center",
                    value.includes(option.value) 
                      ? "bg-primary border-primary" 
                      : "border-input"
                  )}>
                    {value.includes(option.value) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm">{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type Location = {
  _id: string;
  name: string;
  description?: string;
  inventoryType?: string;
  category?: string;
  items?: string[];
};

  /* Item type definition for local usage */
  type Item = {
    _id: string;
    item: string;
    package?: string;
    restockPackageQty: number;
    // ... add other fields if needed for future
  };


export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [availableItems, setAvailableItems] = useState<{ label: string, value: string }[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [viewingLocation, setViewingLocation] = useState<Location | null>(null);
  const [viewingItemsLocation, setViewingItemsLocation] = useState<Location | null>(null);

  // Pagination & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter & Paginate
  const filteredLocations = locations.filter((loc) => 
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.inventoryType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLocations.length / itemsPerPage);
  const paginatedLocations = filteredLocations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    inventoryType: "",
    category: "",
    items: [] as string[],
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/items");
      if (response.ok) {
        const data = await response.json();
        setAllItems(data);
        setAvailableItems(data.map((i: any) => ({ label: i.item, value: i._id })));
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/locations");
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchItems();
  }, []);

  const handleOpenDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        name: location.name,
        description: location.description || "",
        inventoryType: location.inventoryType || "",
        category: location.category || "",
        items: location.items || [],
      });
    } else {
      setEditingLocation(null);
      setFormData({
        name: "",
        description: "",
        inventoryType: "",
        category: "",
        items: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLocation(null);
    setFormLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingLocation) {
        const res = await fetch(`/api/locations/${editingLocation._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        const res = await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to create");
      }
      await fetchLocations();
      handleCloseDialog();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this location?")) return;
    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchLocations();
    } catch (error) {
       console.error("Error deleting location:", error);
    }
  };

  const handleRemoveItemFromLocation = async (locationId: string, itemId: string) => {
    try {
      const location = locations.find(l => l._id === locationId);
      if (!location) return;
      
      const updatedItems = (location.items || []).filter(id => id !== itemId);
      
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...location, items: updatedItems }),
      });
      
      if (!res.ok) throw new Error("Failed to remove item");
      
      // Update local state
      await fetchLocations();
      
      // Update the viewing location state to reflect the change
      if (viewingItemsLocation && viewingItemsLocation._id === locationId) {
        setViewingItemsLocation({ ...viewingItemsLocation, items: updatedItems });
      }
    } catch (error) {
      console.error("Error removing item from location:", error);
    }
  };

  return (

    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with Breadcrumbs & Search */}
      <div className="flex-none h-[6%] min-h-[50px] border-b flex items-center justify-between gap-4 px-4 bg-white z-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          <Link href="/admin" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Locations</span>
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
             <div className="relative max-w-sm w-full md:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search locations..."
                  className="w-full bg-background pl-8 h-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
             <Button
                onClick={() => handleOpenDialog()}
                size="sm"
                className="h-8 gap-1"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Location</span>
              </Button>
        </div>
      </div>

       {/* Main Content Area */}
       <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* Desktop Table */}
        <div className="flex-1 overflow-auto bg-white hidden md:block">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                <TableRow className="hover:bg-muted/50 border-b">
                  <TableHead className="w-[200px] font-semibold pl-4 bg-white">Name</TableHead>
                  <TableHead className="font-semibold bg-white">Description</TableHead>
                  <TableHead className="font-semibold bg-white">Inventory Type</TableHead>
                  <TableHead className="font-semibold bg-white">Category</TableHead>
                  <TableHead className="font-semibold w-[100px] bg-white">Items</TableHead>
                  <TableHead className="w-[50px] bg-white"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No locations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLocations.map((location) => (
                    <TableRow key={location._id} className="hover:bg-muted/50 border-b group">
                      <TableCell className="font-medium pl-4 py-2">
                        <div 
                          className="cursor-pointer hover:underline text-primary"
                          onClick={() => setViewingLocation(location)}
                        >
                          {location.name}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">{location.description || "-"}</TableCell>
                      <TableCell className="py-2">{location.inventoryType || "-"}</TableCell>
                      <TableCell className="py-2">{location.category || "-"}</TableCell>
                      <TableCell className="py-2">
                        <div
                          className="cursor-pointer inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
                          onClick={() => setViewingItemsLocation(location)}
                        >
                          {location.items?.length || 0} items
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setViewingLocation(location)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenDialog(location)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDelete(location._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </div>

             {/* Mobile Card View (kept as is but using paginated data) */}
             <div className="md:hidden flex-1 overflow-auto space-y-4 p-4 pb-20">
              {loading ? (
                 <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                 </div>
              ) : paginatedLocations.length === 0 ? (
                 <div className="text-center text-muted-foreground py-8">
                   No locations found.
                 </div>
              ) : (
                paginatedLocations.map((location) => (
                  <Card key={location._id} className="bg-white shadow-sm border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                       <CardTitle className="text-base font-bold">
                         {location.name}
                       </CardTitle>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 -mr-2">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(location)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDelete(location._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        {location.description || "No description provided."}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Inventory Type:</span>
                          <p className="font-medium">{location.inventoryType || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Category:</span>
                          <p className="font-medium">{location.category || "-"}</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <span className="text-muted-foreground text-sm">Items: </span>
                        <span
                          className="cursor-pointer inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium hover:bg-primary/20 transition-colors"
                          onClick={() => setViewingItemsLocation(location)}
                        >
                          {location.items?.length || 0} items
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {!loading && filteredLocations.length > 0 && (
              <div className="flex-none flex items-center justify-end space-x-2 p-2 border-t bg-white z-20">
                <div className="flex-1 text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLocations.length)} of {filteredLocations.length} entries
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
       </div>

       {/* Mobile Floating Action Button - Only show on mobile now since desktop has it in header */}
       <Button
        onClick={() => handleOpenDialog()}
        className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 p-0"
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Add Location</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inventoryType">Inventory Type</Label>
              <Input
                id="inventoryType"
                value={formData.inventoryType}
                onChange={(e) => setFormData({ ...formData, inventoryType: e.target.value })}
                placeholder="e.g. Room, Cart, Storage"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Housekeeping, Front Desk"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="items">Associated Items</Label>
              <ItemsMultiSelect
                value={formData.items}
                onChange={(val) => setFormData({ ...formData, items: val })}
                options={availableItems}
              />
            </div>
            <DialogFooter>
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

      <Dialog open={!!viewingLocation} onOpenChange={(open) => !open && setViewingLocation(null)}>
        <DialogContent className="sm:max-w-[700px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Location Details</DialogTitle>
          </DialogHeader>
          {viewingLocation && (
            <div className="grid gap-6 py-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-muted-foreground">Name</h4>
                    <p className="font-semibold">{viewingLocation.name}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                    <p>{viewingLocation.description || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-muted-foreground">Inventory Type</h4>
                    <p>{viewingLocation.inventoryType || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-muted-foreground">Category</h4>
                    <p>{viewingLocation.category || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Associated Items</h4>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Available Qty</TableHead>
                        <TableHead>Available Package</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingLocation.items && viewingLocation.items.length > 0 ? (
                        viewingLocation.items.map((itemId) => {
                          const item = allItems.find(i => i._id === itemId);
                          return item ? (
                            <TableRow key={itemId}>
                              <TableCell className="font-medium">{item.item}</TableCell>
                              <TableCell>{item.restockPackageQty}</TableCell>
                              <TableCell>{item.package || "-"}</TableCell>
                            </TableRow>
                          ) : null;
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                            No items associated with this location.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingLocation(null)}>Close</Button>
            <Button variant="outline" onClick={() => {
                setViewingLocation(null);
                handleOpenDialog(viewingLocation!);
            }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Items List Popup */}
      <Dialog open={!!viewingItemsLocation} onOpenChange={(open) => !open && setViewingItemsLocation(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Items in {viewingItemsLocation?.name}</DialogTitle>
          </DialogHeader>
          {viewingItemsLocation && (
            <div className="py-2">
              {viewingItemsLocation.items && viewingItemsLocation.items.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Item</TableHead>
                        <TableHead className="font-semibold text-center">Available Qty</TableHead>
                        <TableHead className="font-semibold text-center">Available Package</TableHead>
                        <TableHead className="font-semibold text-center w-[60px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingItemsLocation.items.map((itemId) => {
                        const item = allItems.find(i => i._id === itemId);
                        return item ? (
                          <TableRow key={itemId}>
                            <TableCell className="font-medium">{item.item}</TableCell>
                            <TableCell className="text-center">0</TableCell>
                            <TableCell className="text-center">{item.restockPackageQty}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveItemFromLocation(viewingItemsLocation._id, itemId)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ) : null;
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No items associated with this location.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingItemsLocation(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
