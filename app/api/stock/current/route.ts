import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import mongoose from "mongoose";

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const locationInfo = searchParams.get("location");

    // Fetch all items to get package sizes
    const Item = mongoose.models.Item || (await import("@/models/Item")).default;
    const items = await Item.find({}).lean();
    const packageSizeMap = new Map<string, number>();
    items.forEach((item: any) => {
        packageSizeMap.set(item._id.toString(), parseInt(item.package || '0') || 0);
    });

    // Build match filter
    const matchFilter: any = {};
    if (locationInfo) {
      matchFilter.location = locationInfo;
    }

    // Get ALL transactions
    // We need all history to find the last Stock Count and calculate deltas
    const transactions = await Transaction.find(matchFilter)
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Group by Item -> Location
    const groups: Record<string, Record<string, any[]>> = {};

    for (const tx of transactions) {
        const itemId = tx.item?.toString();
        const locId = tx.location?.toString();
        
        if (!itemId || !locId) continue;
        
        if (!groups[itemId]) groups[itemId] = {};
        if (!groups[itemId][locId]) groups[itemId][locId] = [];
        
        groups[itemId][locId].push(tx);
    }

    // Calculate totals per item
    const itemTotals = new Map<string, { totalUnit: number; totalPackage: number }>();

    for (const [itemId, locations] of Object.entries(groups)) {
        const packageSize = packageSizeMap.get(itemId) || 0;
        let itemTotalUnits = 0;

        for (const [locId, txns] of Object.entries(locations)) {
             let baseBalance = 0;
             let latestCountDate: number | null = null;
             
             // 1. Find the latest date that has a Stock Count
             for (const tx of txns) {
                if (tx.source === "Stock Count" && tx.date) {
                    latestCountDate = new Date(tx.date).getTime();
                    break;
                }
             }

             let purchasedDelta = 0;
             let consumedDelta = 0;
             let soakDelta = 0;
             
             // 2. Iterate transactions
             for (const tx of txns) {
                 if (!tx.date) continue;
                 const txDate = new Date(tx.date).getTime();

                 if (latestCountDate !== null) {
                     if (txDate === latestCountDate) {
                         if (tx.source === "Stock Count") {
                            const countedPkg = tx.countedPackage || 0;
                            const countedUnit = tx.countedUnit || 0;
                            baseBalance += (countedPkg * packageSize) + countedUnit;
                         }
                         continue;
                     } else if (txDate < latestCountDate) {
                         continue;
                     }
                 }
                 
                 // Transactions newer than latest count (or no count exists)
                 purchasedDelta += (tx.purchasedPackage || 0) * packageSize + (tx.purchasedUnit || 0);
                 consumedDelta += (tx.consumedPackage || 0) * packageSize + (tx.consumedUnit || 0);
                 soakDelta += (tx.soakUnit || 0);
             }
             
             // Calculate final units for this location
             const currentUnits = baseBalance + purchasedDelta - consumedDelta - soakDelta;
             itemTotalUnits += currentUnits;
        }

        // Add to global item totals
        // Convert total units back to packages/units for display if needed
        const totalPackages = packageSize > 0 ? Math.floor(itemTotalUnits / packageSize) : 0;
        const totalUnitsRemainder = packageSize > 0 ? itemTotalUnits % packageSize : itemTotalUnits;

        itemTotals.set(itemId, {
            totalUnit: totalUnitsRemainder,
            totalPackage: totalPackages
        });
    }

    // Convert to array format
    const currentStock = Array.from(itemTotals.entries()).map(([item, totals]) => ({
      item,
      totalUnit: totals.totalUnit,
      totalPackage: totals.totalPackage,
    }));

    return NextResponse.json(currentStock);
  } catch (error) {
    console.error("Error fetching current stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}
