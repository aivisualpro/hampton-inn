"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRef } from "react";
import { Loader2, ChevronRight, Search, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { format } from "date-fns";

type Transaction = {
  _id: string;
  date: string;
  item: string; // ID
  location: string; // ID
  countedUnit: number; // Closing Count
  soakUnit: number;
  consumedUnit: number;
  purchasedUnit?: number;
  createdAt: string;
  relatedParentItem?: string;
};

type Item = {
  _id: string;
  item: string;
};

type Location = {
  _id: string;
  name: string;
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [totalStockMap, setTotalStockMap] = useState<Record<string, { totalUnit: number; totalPackage: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  
  // Infinite Scroll state
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Edit State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const { toast } = useToast();
  
  // Delete Dialog State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [transRes, itemsRes, locRes, stockRes] = await Promise.all([
        fetch("/api/transactions"),
        fetch("/api/items"),
        fetch("/api/locations"),
        fetch("/api/stock/current"),
      ]);

      if (!transRes.ok) throw new Error("Failed to fetch transactions");
      const transData = await transRes.json();
      setTransactions(transData);

      if (itemsRes.ok) {
        const itemsData: Item[] = await itemsRes.json();
        const itemMap: Record<string, string> = {};
        itemsData.forEach((i) => (itemMap[i._id] = i.item));
        setItems(itemMap);
      }

      if (locRes.ok) {
        const locData: Location[] = await locRes.json();
        const locMap: Record<string, string> = {};
        locData.forEach((l) => (locMap[l._id] = l.name));
        setLocations(locMap);
      }

      if (stockRes.ok) {
          const stockData = await stockRes.json();
          const stockMap: Record<string, { totalUnit: number; totalPackage: number }> = {};
          stockData.forEach((s: any) => {
              stockMap[s.item] = { totalUnit: s.totalUnit, totalPackage: s.totalPackage };
          });
          setTotalStockMap(stockMap);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction({ ...t });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setTransactionToDelete(id);
      setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    const id = transactionToDelete;
    setIsDeleteDialogOpen(false); // Close dialog immediately
    setTransactionToDelete(null);

    // Optimistic Update
    const prevTransactions = [...transactions];
    setTransactions(prev => prev.filter(t => t._id !== id));
    toast({ title: "Transaction deleted", description: "The transaction has been removed." });

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed");
      }
    } catch (e) {
      console.error(e);
      // Revert
      setTransactions(prevTransactions);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete transaction." });
    }
  };

  const handleUpdate = async () => {
    if (!editingTransaction) return;
    
    // Optimistic Update
    const prevTransactions = [...transactions];
    setTransactions(prev => prev.map(t => t._id === editingTransaction._id ? editingTransaction : t));
    
    // Close modal visually immediately
    setIsEditDialogOpen(false);
    setEditingTransaction(null);
    
    toast({ title: "Transaction updated", description: "Changes have been applied." });

    setSaveLoading(true);
    try {
      const res = await fetch(`/api/transactions/${editingTransaction._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTransaction),
      });

      if (!res.ok) {
        throw new Error("Failed update");
      }
    } catch (e) {
      console.error(e);
      // Revert
      setTransactions(prevTransactions);
      toast({ variant: "destructive", title: "Update failed", description: "Reverting changes." });
    } finally {
      setSaveLoading(false);
    }
  };

  // Filter
  const filteredTransactions = transactions.filter(t => {
      const itemName = items[t.item] || "Unknown Item";
      const locName = locations[t.location] || "Unknown Location";
      const query = searchQuery.toLowerCase();
      
      return (
          itemName.toLowerCase().includes(query) ||
          locName.toLowerCase().includes(query)
      );
  });

  // Infinite Scroll Handler
  const handleScroll = () => {
    if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50) { // Load more when near bottom
             setVisibleCount(prev => Math.min(prev + 20, filteredTransactions.length));
        }
    }
  };

  // Reset visible count on search
  useEffect(() => {
      setVisibleCount(20);
  }, [searchQuery]);


  const displayedTransactions = filteredTransactions.slice(0, visibleCount);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none h-[6%] min-h-[50px] border-b flex items-center justify-between gap-4 px-4 bg-white z-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Transactions</span>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-sm w-full md:w-64">
             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               type="search"
               placeholder="Search transactions..."
               className="w-full bg-background pl-8 h-8 text-sm"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
          <div 
            className="flex-1 overflow-auto bg-white" 
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <Table>
                <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                    <TableRow className="bg-gray-50/50 border-b">
                        <TableHead className="w-[100px] pl-4">Type</TableHead>
                        <TableHead className="w-[100px] pl-4">Date</TableHead>
                        <TableHead className="w-[150px]">Location</TableHead>
                        <TableHead className="w-[150px]">Item</TableHead>
                        <TableHead className="text-center bg-gray-100/50">Opening</TableHead>
                        <TableHead className="text-center">Counted</TableHead>
                        <TableHead className="text-center text-red-600">Cons/Disp</TableHead>
                        <TableHead className="text-center text-blue-600">Purch/Soak</TableHead>
                        <TableHead className="text-center font-bold bg-gray-100/50">Closing</TableHead>
                        <TableHead className="text-center font-bold text-green-700 bg-green-50/50">Total Balance</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                         <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : displayedTransactions.length === 0 ? (
                        <TableRow>
                             <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                No transactions found.
                             </TableCell>
                        </TableRow>
                    ) : (
                        <>
                            {displayedTransactions.map((t) => {
                                // Calculate Opening Balance
                                // Closing(Counted) = Opening + Purchase + Soak - Consumed
                                // Opening = Closing - Purchase - Soak + Consumed
                                const opening = (t.countedUnit || 0) - (t.purchasedUnit || 0) - (t.soakUnit || 0) + (t.consumedUnit || 0);
                                const purchSoak = (t.purchasedUnit || 0) + (t.soakUnit || 0);

                                return (
                                <TableRow key={t._id} className="hover:bg-muted/50 border-b">
                                    <TableCell className="pl-4 font-medium text-xs whitespace-nowrap text-muted-foreground w-[100px]">
                                        {(() => {
                                            const types = [];
                                            if ((t.soakUnit || 0) > 0) types.push("Soak Cycle");
                                            if ((t.purchasedUnit || 0) > 0) types.push("Purchase");
                                            if ((t.consumedUnit || 0) > 0) types.push("Daily Occupancy");
                                            // If no specific activity but still exists, it's a Count (or if explicitly counted)
                                            if (types.length === 0) types.push("Count");
                                            
                                            // Prioritize display or join
                                            return types.join(", ");
                                        })()}
                                    </TableCell>
                                    <TableCell className="pl-4 font-medium text-xs whitespace-nowrap">
                                        {format(new Date(t.date), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {locations[t.location] || t.location}
                                    </TableCell>
                                    <TableCell className="text-xs font-medium text-gray-700">
                                        <div>
                                            {items[t.item] || t.item}
                                            {t.relatedParentItem && (
                                              <span className="block text-[10px] text-muted-foreground">
                                                (via {items[t.relatedParentItem] || "Parent Item"})
                                              </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs bg-gray-50/50 text-gray-600">
                                        {opening}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs">
                                        {t.countedUnit}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs text-red-600">
                                        {t.consumedUnit > 0 ? t.consumedUnit : "-"}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs text-blue-600">
                                        {purchSoak > 0 ? purchSoak : "-"}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold bg-gray-50/50">
                                        {t.countedUnit}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-green-700 bg-green-50/50">
                                        {totalStockMap[t.item]?.totalUnit || 0}
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
                                              <DropdownMenuItem onClick={() => handleDeleteClick(t._id)} className="text-red-600">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                      </TableCell>
                                  </TableRow>
                              )})}
                              {/* Loading indicator for infinite scroll if needed, though strictly we just append rows */}
                              {visibleCount < filteredTransactions.length && (
                                  <TableRow>
                                      <TableCell colSpan={9} className="h-12 text-center text-xs text-muted-foreground">
                                          Scroll for more...
                                      </TableCell>
                                  </TableRow>
                              )}
                        </>
                      )}
                  </TableBody>
              </Table>
            </div>
            {/* Footer Status Bar */}
            <div className="flex-none h-[40px] border-t bg-gray-50 flex items-center justify-between px-4 text-xs text-muted-foreground">
                <div>
                   Showing <strong>{displayedTransactions.length}</strong> of <strong>{filteredTransactions.length}</strong> transactions
                </div>
                {displayedTransactions.length < filteredTransactions.length && (
                    <div className="animate-pulse">Scroll down to load more</div>
                )}
            </div>
        </div>
  
         <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the transaction and affect stock calculations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                <Label className="text-right">Item</Label>
                <div className="col-span-3 font-medium text-sm text-muted-foreground">
                   {items[editingTransaction.item] || editingTransaction.item}
                </div>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Location</Label>
                <div className="col-span-3 font-medium text-sm text-muted-foreground">
                   {locations[editingTransaction.location] || editingTransaction.location}
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
                   onWheel={(e) => (e.target as HTMLInputElement).blur()} 
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
                   onWheel={(e) => (e.target as HTMLInputElement).blur()} 
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
                   onWheel={(e) => (e.target as HTMLInputElement).blur()}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="closing" className="text-right">Counted</Label>
                <Input 
                   id="closing" 
                   type="number" 
                   value={editingTransaction.countedUnit}
                   onChange={(e) => setEditingTransaction({...editingTransaction, countedUnit: parseInt(e.target.value) || 0})}
                   className="col-span-3 border-blue-200 bg-blue-50/50" 
                   onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
