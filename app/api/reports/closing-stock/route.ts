import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Item from "@/models/Item";
import Location from "@/models/Location";
import Transaction from "@/models/Transaction";

export async function GET(request: NextRequest) {
    await connectToDatabase();
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get("date"); // YYYY-MM-DD

        // Build the end-of-day cutoff for the target date
        let cutoffDate: Date;
        if (dateParam) {
            cutoffDate = new Date(dateParam + "T23:59:59.999Z");
        } else {
            cutoffDate = new Date();
            cutoffDate.setHours(23, 59, 59, 999);
        }

        // 1. Fetch ALL Items
        const items = await Item.find().lean();
        const itemIds = items.map(i => i._id.toString());
        
        // 2. Fetch Locations
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

        // 3. Fetch transactions up to and including the cutoff date
        const transactions = await Transaction.find({
            item: { $in: itemIds },
            date: { $lte: cutoffDate },
        })
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

                for (const tx of txns) {
                    if ((tx as any).source === "Stock Count" && (tx as any).date) {
                        latestCountDate = new Date((tx as any).date).getTime();
                        break;
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

                    purchasedDelta += ((tx as any).purchasedPackage || 0) * pkgSize + ((tx as any).purchasedUnit || 0);
                    consumedDelta += ((tx as any).consumedPackage || 0) * pkgSize + ((tx as any).consumedUnit || 0);
                    soakDelta += ((tx as any).soakUnit || 0);
                }

                const currentUnits = baseBalance + purchasedDelta - consumedDelta - soakDelta;
                stockMap[itemId][locId] = currentUnits;
            }
        }
        
        return NextResponse.json({
            items,
            locations,
            stockMap
        });

    } catch (e: any) {
        console.error("Closing Stock Report Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
