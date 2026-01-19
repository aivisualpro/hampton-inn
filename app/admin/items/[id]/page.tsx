"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Calendar, ChevronRight, Pencil, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Trash2, MoreHorizontal } from "lucide-react";
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

type Item = {
  _id: string;
  item: string;
  category: string;
  subCategory: string;
  costPerPackage: number;
  package: string;
  restockPackageQty: number;
  defaultKingRoomQty: number;
  defaultDoubleQueenQty: number;
  isBundle?: boolean;
  bundleItems?: { item: { item: string }; quantity: number }[];
};

type StockBreakdown = {
  locationName: string;
  locationId: string;
  totalUnit: number;
  totalPackage: number;
};

type Transaction = {
  _id: string;
  date: string;
  item: string;
  location: string;
  countedUnit: number;
  countedPackage: number;
  purchasedUnit: number; // Added
  soakUnit: number;      // Added
  consumedUnit: number;  // Added
  updatedAt: string;
};

type Location = {
  _id: string;
  name: string;
};

export default function ItemDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [stockBreakdown, setStockBreakdown] = useState<StockBreakdown[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchDetails = async () => {
      if (!id) return;
      // Partial refresh of transactions
      try {
           const res = await fetch(`/api/transactions?item=${id}`);
           if (res.ok) setTransactions(await res.json());
           // Also refresh stock as it might change
           const stockRes = await fetch(`/api/stock/item/${id}`);
           if (stockRes.ok) setStockBreakdown(await stockRes.json());
      } catch (e) { console.error(e); }
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction({ ...t }); // Clone
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (transactionId: string) => {
      if (!confirm("Are you sure you want to delete this transaction record? This will affect stock calculations.")) return;
      
      try {
          const res = await fetch(`/api/transactions/${transactionId}`, { method: "DELETE" });
          if (res.ok) {
              await fetchDetails();
          } else {
              alert("Failed to delete");
          }
      } catch (e) {
          console.error(e);
          alert("Error deleting");
      }
  };

  const handleUpdate = async () => {
      if (!editingTransaction) return;
      setSaveLoading(true);
      try {
          const res = await fetch(`/api/transactions/${editingTransaction._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(editingTransaction)
          });
          
          if (res.ok) {
              setIsEditDialogOpen(false);
              setEditingTransaction(null);
              await fetchDetails();
          } else {
              alert("Failed to update");
          }
      } catch (e) {
          console.error(e);
          alert("Error updating");
      } finally {
          setSaveLoading(false);
      }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [itemRes, stockRes, transactionsRes, locationsRes] = await Promise.all([
          fetch(`/api/items/${id}`),
          fetch(`/api/stock/item/${id}`),
          fetch(`/api/transactions?item=${id}`),
          fetch(`/api/locations`),
        ]);

        if (itemRes.ok) {
          setItem(await itemRes.json());
        }

        if (stockRes.ok) {
          setStockBreakdown(await stockRes.json());
        }

        if (transactionsRes.ok) {
          setTransactions(await transactionsRes.json());
        }

        if (locationsRes.ok) {
          const locs: Location[] = await locationsRes.json();
          const locMap: Record<string, string> = {};
          locs.forEach((l) => (locMap[l._id] = l.name));
          setLocations(locMap);
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold">Item not found</h2>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  // Calculate totals for stock breakdown
  const totalUnits = stockBreakdown.reduce((sum, s) => sum + s.totalUnit, 0);
  const totalPackages = stockBreakdown.reduce((sum, s) => sum + s.totalPackage, 0);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin/items" className="hover:text-primary hover:underline">Items</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground line-clamp-1">{item.item}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button size="sm" onClick={() => router.push(`/admin/items?editId=${item._id}`)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        </div>
      </div>



      <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-5">
        {/* Left Column - 40% */}
        <div className="col-span-1 flex flex-col gap-6 md:col-span-2">
          {/* Item Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Details</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="font-normal">{item.category}</Badge>
                  {item.subCategory && <Badge variant="outline" className="font-normal">{item.subCategory}</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-col gap-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cost per Package</span>
                  <span className="font-medium">${item.costPerPackage.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-medium">{item.package || "-"}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Restock Threshold</span>
                  <span className="font-medium">{item.restockPackageQty}</span>
                </div>
                <Separator />
                 <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Default King Qty</span>
                  <span className="font-medium">{item.defaultKingRoomQty}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Default Dbl Queen Qty</span>
                  <span className="font-medium">{item.defaultDoubleQueenQty}</span>
                </div>
                {item.isBundle && item.bundleItems && item.bundleItems.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-3 pt-2">
                      <div className="text-sm font-medium flex items-center gap-2 text-amber-700">
                        <Layers className="h-4 w-4" /> Bundle Contents:
                      </div>
                      <div className="grid gap-2">
                        {item.bundleItems.map((bi, i) => (
                           <div key={i} className="flex justify-between items-center text-sm bg-muted/40 p-2 rounded-md border">
                             <span className="text-foreground">{bi.item.item}</span>
                             <Badge variant="outline" className="bg-white">x{bi.quantity}</Badge>
                           </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stock by Location Table */}
          <Card className="flex-1">

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Units</TableHead>
                    <TableHead className="text-center">Packages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockBreakdown.map((stock) => (
                    <TableRow key={stock.locationId}>
                      <TableCell className="font-medium">{stock.locationName}</TableCell>
                      <TableCell className="text-center">{stock.totalUnit}</TableCell>
                      <TableCell className="text-center">{stock.totalPackage}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center text-blue-600">{totalUnits}</TableCell>
                    <TableCell className="text-center text-blue-600">{totalPackages}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 60% */}
        <div className="col-span-1 flex flex-col md:col-span-3">
          <Card className="flex h-full flex-col">

              <CardContent className="flex-1 overflow-auto p-0">
               <div className="relative h-full overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">Opening</TableHead>
                      <TableHead className="text-center">Purchase</TableHead>
                      <TableHead className="text-center">Soak</TableHead>
                      <TableHead className="text-center">Cons/Disp</TableHead>
                      <TableHead className="text-center font-bold">Closing</TableHead>
                      <TableHead className="text-center font-bold text-green-700 bg-green-50/50">Total Balance</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((t) => {
                         const opening = (t.countedUnit || 0) - (t.purchasedUnit || 0) - (t.soakUnit || 0) + (t.consumedUnit || 0);

                         return (
                        <TableRow key={t._id}>
                          <TableCell className="text-xs text-muted-foreground font-medium">
                              {(() => {
                                  const types = [];
                                  if ((t.soakUnit || 0) > 0) types.push("Soak Cycle");
                                  if ((t.purchasedUnit || 0) > 0) types.push("Purchase");
                                  if ((t.consumedUnit || 0) > 0) types.push("Daily Occupancy");
                                  if (types.length === 0) types.push("Count");
                                  return types.join(", ");
                              })()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {format(new Date(t.date), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>{locations[t.location] || "Unknown Location"}</TableCell>
                          <TableCell className="text-center">{opening}</TableCell>
                          <TableCell className="text-center">{t.purchasedUnit || 0}</TableCell>
                          <TableCell className="text-center">{t.soakUnit || 0}</TableCell>
                          <TableCell className="text-center">{t.consumedUnit || 0}</TableCell>
                          <TableCell className="text-center font-bold">{t.countedUnit}</TableCell>
                          <TableCell className="text-center font-bold text-green-700 bg-green-50/50">
                             {totalUnits}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditClick(t)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(t._id)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )})
                    )}
                  </TableBody>
                </Table>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update transaction details manually.
            </DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Date</Label>
                <div className="col-span-3 font-medium">
                   {format(new Date(editingTransaction.date), "PPP")}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="purchased" className="text-right">Purchase</Label>
                <Input 
                   id="purchased" 
                   type="number" 
                   value={editingTransaction.purchasedUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, purchasedUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="soak" className="text-right">Soak</Label>
                <Input 
                   id="soak" 
                   type="number" 
                   value={editingTransaction.soakUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, soakUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3" 
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="consumed" className="text-right">Consumed</Label>
                <Input 
                   id="consumed" 
                   type="number" 
                   value={editingTransaction.consumedUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, consumedUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="closing" className="text-right">Closing Count</Label>
                <Input 
                   id="closing" 
                   type="number" 
                   value={editingTransaction.countedUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, countedUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3 border-blue-200 bg-blue-50/50" 
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saveLoading}>
              {saveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
