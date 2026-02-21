
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Item from "@/models/Item";
import Location from "@/models/Location";
import Settings from "@/models/Settings";
import Transaction from "@/models/Transaction";

export async function GET() {
    await connectToDatabase();
    try {
        // 1. Fetch Settings
        const settings = await Settings.findOne().lean();
        
        // 2. Fetch Items (Filtered)
        // Check for items where king OR queen qty > 0
        const items = await Item.find({
            $or: [
                { defaultKingRoomQty: { $gt: 0 } },
                { defaultDoubleQueenQty: { $gt: 0 } }
            ]
        }).lean();
        
        const itemIds = items.map(i => i._id.toString());
        
        // 3. Fetch Locations
        const locations = await Location.find().lean();
        
        // Helper to get package size
        const getPackageSize = (pkgStr?: string) => {
            if (!pkgStr) return 1;
            const match = pkgStr.match(/(\d+)/);
            return match ? parseInt(match[0], 10) : 1;
        };

        // Create Map of Items for package size lookup
        const itemMap = new Map();
        items.forEach(i => itemMap.set(i._id.toString(), i));

        // 4. Calculate closing stock per item per location
        // Same logic as /api/stock/current: find latest Stock Count, use it as base,
        // then add deltas from transactions after that count.
        const transactions = await Transaction.find({ item: { $in: itemIds } })
            .sort({ date: -1, createdAt: -1 })
            .lean();

        // Group by Item -> Location
        const groups: Record<string, Record<string, any[]>> = {};
        for (const tx of transactions) {
            const iId = (tx as any).item?.toString();
            const lId = (tx as any).location?.toString();
            if (!iId || !lId) continue;
            if (!groups[iId]) groups[iId] = {};
            if (!groups[iId][lId]) groups[iId][lId] = [];
            groups[iId][lId].push(tx);
        }

        // Calculate closing stock per item per location
        const stockMap: Record<string, Record<string, number>> = {};
        for (const [itemId, locs] of Object.entries(groups)) {
            const item = itemMap.get(itemId);
            const pkgSize = item ? getPackageSize(item.package) : 1;

            if (!stockMap[itemId]) stockMap[itemId] = {};

            for (const [locId, txns] of Object.entries(locs)) {
                let baseBalance = 0;
                let latestCountDate: number | null = null;

                // Find the latest Stock Count date
                for (const tx of txns) {
                    if ((tx as any).source === "Stock Count" && (tx as any).date) {
                        latestCountDate = new Date((tx as any).date).getTime();
                        break; // txns are sorted desc, so first match is latest
                    }
                }

                let purchasedDelta = 0;
                let consumedDelta = 0;
                let soakDelta = 0;

                for (const tx of txns) {
                    if (!(tx as any).date) continue;
                    const txDate = new Date((tx as any).date).getTime();

                    if (latestCountDate !== null) {
                        if (txDate === latestCountDate) {
                            if ((tx as any).source === "Stock Count") {
                                const countedPkg = (tx as any).countedPackage || 0;
                                const countedUnit = (tx as any).countedUnit || 0;
                                baseBalance += (countedPkg * pkgSize) + countedUnit;
                            }
                            continue;
                        } else if (txDate < latestCountDate) {
                            continue;
                        }
                    }

                    // Transactions newer than latest count (or no count exists)
                    purchasedDelta += ((tx as any).purchasedPackage || 0) * pkgSize + ((tx as any).purchasedUnit || 0);
                    consumedDelta += ((tx as any).consumedPackage || 0) * pkgSize + ((tx as any).consumedUnit || 0);
                    soakDelta += ((tx as any).soakUnit || 0);
                }

                const currentUnits = baseBalance + purchasedDelta - consumedDelta - soakDelta;
                stockMap[itemId][locId] = currentUnits;
            }
        }
        
        return NextResponse.json({
            settings: settings || { defaultKingRoomCount: 0, defaultDoubleQueenRoomCount: 0 },
            items,
            locations,
            stockMap
        });

    } catch (e: any) {
        console.error("Par Level Report Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
