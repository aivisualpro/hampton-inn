import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import Item from "@/models/Item";

/**
 * Combined API for fetching all stock data for a location and date in a single call.
 * This eliminates multiple round trips and uses optimized aggregation pipelines.
 * 
 * Returns:
 * - openingBalances: Map of item ID -> { unit, package } (previous day's closing)
 * - transactions: Current day's transactions
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const locationId = searchParams.get("location");
    
    if (!dateStr || !locationId) {
      return NextResponse.json({ error: "Date and location required" }, { status: 400 });
    }

    // Parse date strictly as UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

    // Build location match condition
    const locationMatch = mongoose.Types.ObjectId.isValid(locationId)
      ? { $in: [locationId, new mongoose.Types.ObjectId(locationId)] }
      : locationId;

    // Run queries in parallel
    const [allPriorTransactions, currentTransactions, items] = await Promise.all([
      // Get ALL transactions BEFORE today for this location
      Transaction.find({
        location: locationId,
        date: { $lt: targetDate }
      } as any).sort({ date: -1, createdAt: -1 }).lean(),
      
      // Current Transactions: Get all transactions for the target date
      Transaction.find({
        location: locationId,
        date: { $gte: targetDate, $lt: nextDay }
      }).lean(),
      
      // Get all items to know package sizes
      Item.find({}).lean(),
    ]);

    // Create package size map
    const packageSizeMap = new Map<string, number>();
    for (const item of items) {
      const pkgSize = parseInt(item.package || '0') || 0;
      packageSizeMap.set(item._id.toString(), pkgSize);
    }

    // Calculate opening balance for each item:
    // Opening = Last Stock Count Value - Sum of consumption after that Stock Count
    const openingMap: Record<string, { unit: number; package: number }> = {};
    
    // Group prior transactions by item
    const priorByItem: Record<string, any[]> = {};
    for (const tx of allPriorTransactions) {
      if (!priorByItem[tx.item]) priorByItem[tx.item] = [];
      priorByItem[tx.item].push(tx);
    }

    // For each item, calculate the running balance
    for (const [itemId, txns] of Object.entries(priorByItem)) {
      const pkgSize = packageSizeMap.get(itemId) || 1;
      
      // Group transactions by relatedParentItem (to separate "Main" flow from "Bundle" flows)
      // This ensures that a Stock Count for "King Sets" resets the "King Set" stream, 
      // but adds to the "Main Item" stream.
      const groups = new Map<string, { counts: any[], deltas: any[] }>();
      
      for (const tx of txns) {
          const key = tx.relatedParentItem || "MAIN";
          if (!groups.has(key)) {
              groups.set(key, { counts: [], deltas: [] });
          }
          const g = groups.get(key)!;
          if (tx.source === "Stock Count") {
              g.counts.push(tx);
          } else {
              g.deltas.push(tx);
          }
      }
      
      let accOpeningTotal = 0;
      
      // Calculate balance for each group and sum them
      for (const group of groups.values()) {
          // 1. Find latest Stock Count in this group
          let baseBalance = 0;
          let cutoffTime = 0;
          
          let latestCountTx: any = null;
          for (const tx of group.counts) {
              if (!latestCountTx || new Date(tx.date).getTime() > new Date(latestCountTx.date).getTime()) {
                  latestCountTx = tx;
              }
          }
          
          if (latestCountTx) {
              baseBalance = (latestCountTx.countedUnit || 0) + ((latestCountTx.countedPackage || 0) * pkgSize);
              cutoffTime = new Date(latestCountTx.date).getTime();
          }
          
          // 2. Sum Deltas strictly AFTER the cutoff
          let groupDelta = 0;
          for (const tx of group.deltas) {
              if (new Date(tx.date).getTime() > cutoffTime) {
                   const purchased = (tx.purchasedUnit || 0) + ((tx.purchasedPackage || 0) * pkgSize);
                   const soak = (tx.soakUnit || 0) + ((tx.soakPackage || 0) * pkgSize);
                   const consumed = (tx.consumedUnit || 0) + ((tx.consumedPackage || 0) * pkgSize);
                   
                   groupDelta += (purchased + soak - consumed);
              }
          }
          
          accOpeningTotal += (baseBalance + groupDelta);
      }
      

      
      // Convert back to packages and units
      if (pkgSize > 0 && pkgSize !== 1) {
        const openingPkg = Math.floor(accOpeningTotal / pkgSize);
        const openingUnit = accOpeningTotal % pkgSize;
        openingMap[itemId] = { unit: openingUnit, package: openingPkg };
      } else {
        openingMap[itemId] = { unit: accOpeningTotal, package: 0 };
      }
    }

    // Aggregate transaction values by item for today
    const transactionMap: Record<string, any> = {};
    for (const tx of currentTransactions) {
      if (!transactionMap[tx.item]) {
        transactionMap[tx.item] = {
          consumedUnit: 0,
          consumedPackage: 0,
          purchasedUnit: 0,
          purchasedPackage: 0,
          soakUnit: 0,
          countedUnit: undefined,
          countedPackage: undefined,
        };
      }
      // Sum up values from all transactions for this item
      // We exclude Stock Count deltas because they represent adjustments to reach the Count, not independent activity.
      // The 'counted' value is the authority.
      if (tx.source !== "Stock Count") {
          transactionMap[tx.item].consumedUnit += tx.consumedUnit || 0;
          transactionMap[tx.item].consumedPackage += tx.consumedPackage || 0;
          transactionMap[tx.item].purchasedUnit += tx.purchasedUnit || 0;
          transactionMap[tx.item].purchasedPackage += tx.purchasedPackage || 0;
          transactionMap[tx.item].soakUnit += tx.soakUnit || 0;
      }
      
      // Keep the counted values from Stock Count
      if (tx.source === "Stock Count") {
        transactionMap[tx.item].countedUnit = tx.countedUnit || 0;
        transactionMap[tx.item].countedPackage = tx.countedPackage || 0;
      }
    }

    return NextResponse.json({
      openingBalances: openingMap,
      transactions: transactionMap,
    });

  } catch (error) {
    console.error("Error fetching combined stock data:", error);
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 500 });
  }
}
