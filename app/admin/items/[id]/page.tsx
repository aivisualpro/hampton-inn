"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ChevronRight, Pencil, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TransactionsList } from "@/components/transactions/TransactionsList";

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

export default function ItemDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [stockBreakdown, setStockBreakdown] = useState<StockBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [itemRes, stockRes] = await Promise.all([
          fetch(`/api/items/${id}`),
          fetch(`/api/stock/item/${id}`),
        ]);

        if (itemRes.ok) {
          setItem(await itemRes.json());
        }

        if (stockRes.ok) {
          setStockBreakdown(await stockRes.json());
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

  const hasPackage = Boolean(item.package && item.package !== "0");

  const getPackageSize = (packageStr?: string): number => {
    if (!packageStr) return 1;
    const match = packageStr.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 1;
  };

  const packageSize = getPackageSize(item.package);
  const grandTotalCount = (totalPackages * packageSize) + totalUnits;

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
                    {hasPackage && <TableHead className="text-center">Packages</TableHead>}
                    <TableHead className="text-center font-bold text-green-600">Total Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockBreakdown.map((stock) => (
                    <TableRow key={stock.locationId}>
                      <TableCell className="font-medium">{stock.locationName}</TableCell>
                      <TableCell className="text-center">{stock.totalUnit}</TableCell>
                      {hasPackage && <TableCell className="text-center">{stock.totalPackage}</TableCell>}
                      <TableCell className="text-center font-bold text-green-600">{(stock.totalPackage * packageSize) + stock.totalUnit}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center text-blue-600">{totalUnits}</TableCell>
                    {hasPackage && <TableCell className="text-center text-blue-600">{totalPackages}</TableCell>}
                    <TableCell className="text-center font-extrabold text-green-700">{grandTotalCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 60% */}
        <div className="col-span-1 flex flex-col md:col-span-3 h-full overflow-hidden">
            <div className="bg-white border rounded-lg h-full overflow-hidden shadow-sm">
                <TransactionsList itemId={id} />
            </div>
        </div>
      </div>
    </div>
  );
}
