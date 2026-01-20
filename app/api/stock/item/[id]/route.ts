import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import Location from "@/models/Location";
import mongoose from "mongoose";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    // Validate Item ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid Item ID" }, { status: 400 });
    }

    // Fetch the item to get package size
    const Item = mongoose.models.Item || (await import("@/models/Item")).default;
    const itemDoc = await Item.findById(id);
    const packageSize = parseInt(itemDoc?.package || '0') || 0;

    // Get ALL transactions for this item
    const transactions = await Transaction.find({ item: id })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Group by location
    const outputByLocation: any[] = [];
    const locationGroups: Record<string, any[]> = {};
    const locationIds = new Set<string>();

    for (const tx of transactions) {
      const locId = tx.location?.toString();
      if (!locId) continue;
      if (!locationGroups[locId]) locationGroups[locId] = [];
      locationGroups[locId].push(tx);
      locationIds.add(locId);
    }

    // Process each location
    for (const locationId of locationIds) {
      const txns = locationGroups[locationId];
      
      let baseBalance = 0;
      let latestCountDate: number | null = null;

      // Group transactions by relatedParentItem (Main vs Bundle flows)
      // Key: relatedParentItem ID or "MAIN"
      // Value: { counts: [], deltas: [] }
      const groups = new Map<string, { counts: any[], deltas: any[] }>();
      
      for (const tx of txns) {
          const key = (tx as any).relatedParentItem || "MAIN";
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
      
      let finalTotalUnits = 0;
      
      // Calculate balance for each group and sum them
      for (const group of groups.values()) {
           // 1. Find latest Stock Count in this group
           let baseBalance = 0;
           let cutoffTime = 0;
           
           let latestCountTx: any = null;
           for (const tx of group.counts) {
               if (tx.date) {
                   const tTime = new Date(tx.date).getTime();
                   if (!latestCountTx || tTime > new Date(latestCountTx.date).getTime()) {
                       latestCountTx = tx;
                   }
               }
           }
           
           if (latestCountTx) {
               baseBalance = (latestCountTx.countedUnit || 0) + ((latestCountTx.countedPackage || 0) * packageSize);
               cutoffTime = new Date(latestCountTx.date).getTime();
           }
           
           // 2. Sum Deltas strictly AFTER the cutoff
           let groupDelta = 0;
           for (const tx of group.deltas) {
               if (tx.date && new Date(tx.date).getTime() > cutoffTime) {
                    const purchased = (tx.purchasedUnit || 0) + ((tx.purchasedPackage || 0) * packageSize);
                    const soak = (tx.soakUnit || 0);
                    const consumed = (tx.consumedUnit || 0) + ((tx.consumedPackage || 0) * packageSize);
                    
                    // Note: TransactionsList ADDS soak. So we add it here too.
                    groupDelta += (purchased + soak - consumed);
               }
           }
           
           finalTotalUnits += (baseBalance + groupDelta);
      }
      
      // Convert back to packages/units display
      const finalPackages = packageSize > 0 ? Math.floor(finalTotalUnits / packageSize) : 0;
      const finalUnits = packageSize > 0 ? finalTotalUnits % packageSize : finalTotalUnits;
      
      outputByLocation.push({
        locationId,
        locationName: "Unknown", // Placeholder, will fill below
        totalUnit: finalUnits,
        totalPackage: finalPackages,
      });
    }

    // Fill in location names efficiently
    const locDocs = await Promise.all(outputByLocation.map((s: any) => Location.findById(s.locationId)));
    outputByLocation.forEach((s: any, i: number) => {
        s.locationName = locDocs[i]?.name || "Unknown";
    });

    // Sort by location name
    outputByLocation.sort((a, b) => a.locationName.localeCompare(b.locationName));

    return NextResponse.json(outputByLocation);
  } catch (error) {
    console.error("Error fetching stock by location:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}
