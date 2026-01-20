
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

        // 4. Fetch Latest Stock Counts
        // Group by Item + Location, get the latest transaction's countedUnit
        const stockData = await Transaction.aggregate([
            { $match: { item: { $in: itemIds } } },
            { $group: {
                _id: { item: "$item", location: "$location" },
                unitDelta: { 
                    $sum: { 
                        $subtract: [ 
                            { $add: [ { $ifNull: ["$purchasedUnit", 0] }, { $ifNull: ["$soakUnit", 0] } ] }, 
                            { $ifNull: ["$consumedUnit", 0] } 
                        ] 
                    } 
                },
                packageDelta: { 
                    $sum: { 
                        $subtract: [ 
                            { $add: [ { $ifNull: ["$purchasedPackage", 0] }, { $ifNull: ["$soakPackage", 0] } ] }, 
                            { $ifNull: ["$consumedPackage", 0] } 
                        ] 
                    } 
                }
            }}
        ]);
        
        // Transform stockData into a map for easy lookup: { itemId: { locationId: count } }
        const stockMap: Record<string, Record<string, number>> = {};
        stockData.forEach((record: any) => {
            const itemId = record._id.item;
            const locationId = record._id.location;
            
            const item = itemMap.get(itemId);
            const pkgSize = item ? getPackageSize(item.package) : 1;
            
            // Calculate Total Count (Units + Packages * Size)
            const totalCount = record.unitDelta + (record.packageDelta * pkgSize);

            if (!stockMap[itemId]) stockMap[itemId] = {};
            stockMap[itemId][locationId] = totalCount;
        });
        
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
