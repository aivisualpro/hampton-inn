
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Item from "@/models/Item";
import Location from "@/models/Location";
import Transaction from "@/models/Transaction";

export async function GET() {
    await connectToDatabase();
    try {
        // 1. Fetch Items with restock threshold > 0
        const items = await Item.find({ restockPackageQty: { $gt: 0 } }).lean();
        const itemIds = items.map(i => i._id.toString());
        
        // 2. Fetch Locations
        const locations = await Location.find().lean();
        
        // Helper to get package size
        const getPackageSize = (pkgStr?: string) => {
            if (!pkgStr) return 1;
            const match = pkgStr.match(/(\d+)/);
            return match ? parseInt(match[0], 10) : 1;
        };

        const itemMap = new Map();
        items.forEach(i => itemMap.set(i._id.toString(), i));

        // 3. Calculate closing stock per item (total across all locations)
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

        // Calculate closing stock per item (total across all locations)
        const stockTotals: Record<string, number> = {};
        const stockByLocation: Record<string, Record<string, number>> = {};
        
        for (const [itemId, locs] of Object.entries(groups)) {
            const item = itemMap.get(itemId);
            const pkgSize = item ? getPackageSize(item.package) : 1;
            let totalUnits = 0;
            
            if (!stockByLocation[itemId]) stockByLocation[itemId] = {};

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
                stockByLocation[itemId][locId] = currentUnits;
                totalUnits += currentUnits;
            }
            
            stockTotals[itemId] = totalUnits;
        }

        // Build alerts array
        const alerts = items.map((item: any) => {
            const pkgSize = getPackageSize(item.package);
            const totalUnits = stockTotals[item._id.toString()] || 0;
            const totalPackages = pkgSize > 0 ? Math.floor(totalUnits / pkgSize) : totalUnits;
            const restockThreshold = item.restockPackageQty || 0;
            const needsRestock = totalPackages < restockThreshold;
            const deficit = needsRestock ? restockThreshold - totalPackages : 0;
            
            return {
                _id: item._id.toString(),
                item: item.item,
                category: item.category,
                subCategory: item.subCategory,
                package: item.package,
                costPerPackage: item.costPerPackage || 0,
                restockPackageQty: restockThreshold,
                currentTotalUnits: totalUnits,
                currentPackages: totalPackages,
                currentUnitsRemainder: pkgSize > 0 ? totalUnits % pkgSize : totalUnits,
                needsRestock,
                deficit,
                estimatedCost: deficit * (item.costPerPackage || 0),
                locationBreakdown: stockByLocation[item._id.toString()] || {}
            };
        });

        // Sort: items needing restock first (by deficit descending), then alphabetical
        alerts.sort((a: any, b: any) => {
            if (a.needsRestock && !b.needsRestock) return -1;
            if (!a.needsRestock && b.needsRestock) return 1;
            if (a.needsRestock && b.needsRestock) return b.deficit - a.deficit;
            return a.item.localeCompare(b.item);
        });

        return NextResponse.json({
            alerts,
            locations,
            summary: {
                totalItems: alerts.length,
                needsRestock: alerts.filter((a: any) => a.needsRestock).length,
                totalEstimatedCost: alerts.reduce((sum: number, a: any) => sum + a.estimatedCost, 0)
            }
        });

    } catch (e: any) {
        console.error("Restock Alerts Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
