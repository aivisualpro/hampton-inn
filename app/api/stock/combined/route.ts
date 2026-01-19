import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";

/**
 * Combined API for fetching all stock data for a location and date in a single call.
 * This eliminates multiple round trips and uses optimized aggregation pipelines.
 * 
 * Returns:
 * - openingBalances: Map of item ID -> { unit, package }
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

    // Run both queries in parallel for maximum speed
    const [openingBalances, currentTransactions] = await Promise.all([
      // Opening Balances: Get the last countedUnit/Package for each item BEFORE the target date
      Transaction.aggregate([
        {
          $match: {
            location: locationMatch,
            date: { $lt: targetDate }
          }
        },
        { $sort: { date: -1, createdAt: -1 } },
        {
          $group: {
            _id: "$item",
            lastCountedUnit: { $first: "$countedUnit" },
            lastCountedPackage: { $first: "$countedPackage" },
          }
        },
        {
          $project: {
            item: "$_id",
            openingBalance: { $ifNull: ["$lastCountedUnit", 0] },
            openingBalancePackage: { $ifNull: ["$lastCountedPackage", 0] },
            _id: 0
          }
        }
      ]).allowDiskUse(true),
      
      // Current Transactions: Get all transactions for the target date
      Transaction.find({
        location: locationId,
        date: { $gte: targetDate, $lt: nextDay }
      }).lean(),
    ]);

    // Convert arrays to maps for O(1) lookup on the client
    const openingMap: Record<string, { unit: number; package: number }> = {};
    for (const ob of openingBalances) {
      openingMap[ob.item] = {
        unit: ob.openingBalance || 0,
        package: ob.openingBalancePackage || 0
      };
    }

    const transactionMap: Record<string, any> = {};
    for (const tx of currentTransactions) {
      transactionMap[tx.item] = tx;
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
