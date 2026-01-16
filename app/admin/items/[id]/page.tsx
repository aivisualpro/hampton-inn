"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Calendar, ChevronRight } from "lucide-react";
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin" className="hover:text-primary hover:underline">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/items" className="hover:text-primary hover:underline">Items</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground line-clamp-1">{item.item}</span>
      </div>



      <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-5">
        {/* Left Column - 40% */}
        <div className="col-span-1 flex flex-col gap-6 md:col-span-2">
          {/* Item Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
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
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">Counted Units</TableHead>
                      <TableHead className="text-center">Counted Pkgs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((t) => (
                        <TableRow key={t._id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {format(new Date(t.date), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>{locations[t.location] || "Unknown Location"}</TableCell>
                          <TableCell className="text-center">{t.countedUnit}</TableCell>
                          <TableCell className="text-center">{t.countedPackage}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
