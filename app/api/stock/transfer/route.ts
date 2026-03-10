import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import Location from "@/models/Location";
import Item from "@/models/Item";

// GET - Fetch transfer history
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const fromLocation = searchParams.get("fromLocation");
    const toLocation = searchParams.get("toLocation");
    const limit = parseInt(searchParams.get("limit") || "50");

    const query: any = { source: "Stock Transfer" };

    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (fromLocation) {
      query.location = fromLocation;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transfer history:", error);
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 });
  }
}

// POST - Create a stock transfer
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { date, fromLocation, toLocation, items } = body;
    // items: [{ itemId, transferUnit, transferPackage }]

    if (!date || !fromLocation || !toLocation || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Date, fromLocation, toLocation, and items are required" },
        { status: 400 }
      );
    }

    if (fromLocation === toLocation) {
      return NextResponse.json(
        { error: "Source and destination locations cannot be the same" },
        { status: 400 }
      );
    }

    const [year, month, day] = date.split('-').map(Number);
    const now = new Date();
    const saveDate = new Date(Date.UTC(
      year, month - 1, day,
      now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()
    ));
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

    // --- Server-side stock validation ---
    // Get all items to know package sizes
    const allItems = await Item.find({}).lean();
    const packageSizeMap = new Map<string, number>();
    for (const itm of allItems) {
      const pkgSize = parseInt(itm.package || '0') || 1;
      packageSizeMap.set(itm._id.toString(), pkgSize);
    }

    // Get all prior transactions + today's transactions for the source location
    const [priorTransactions, currentTransactions] = await Promise.all([
      Transaction.find({
        location: fromLocation,
        date: { $lt: targetDate }
      }).lean(),
      Transaction.find({
        location: fromLocation,
        date: { $gte: targetDate, $lt: nextDay }
      }).lean(),
    ]);

    // Calculate opening balances per item (sum all prior: purchased + soak - consumed)
    const openingTotals: Record<string, number> = {};
    for (const tx of priorTransactions) {
      const t = tx as any;
      const itemId = t.item?.toString();
      if (!itemId) continue;
      const pkgSize = packageSizeMap.get(itemId) || 1;
      if (!openingTotals[itemId]) openingTotals[itemId] = 0;
      const purchased = (t.purchasedUnit || 0) + ((t.purchasedPackage || 0) * pkgSize);
      const soak = (t.soakUnit || 0) + ((t.soakPackage || 0) * pkgSize);
      const consumed = (t.consumedUnit || 0) + ((t.consumedPackage || 0) * pkgSize);
      if (t.source === "Stock Count") {
        openingTotals[itemId] = (t.countedUnit || 0) + ((t.countedPackage || 0) * pkgSize);
      } else {
        openingTotals[itemId] += (purchased + soak - consumed);
      }
    }

    // Add today's transactions
    const todayTotals: Record<string, number> = {};
    for (const tx of currentTransactions) {
      const t = tx as any;
      const itemId = t.item?.toString();
      if (!itemId) continue;
      const pkgSize = packageSizeMap.get(itemId) || 1;
      if (!todayTotals[itemId]) todayTotals[itemId] = 0;
      if (t.source !== "Stock Count") {
        const purchased = (t.purchasedUnit || 0) + ((t.purchasedPackage || 0) * pkgSize);
        const soak = (t.soakUnit || 0) + ((t.soakPackage || 0) * pkgSize);
        const consumed = (t.consumedUnit || 0) + ((t.consumedPackage || 0) * pkgSize);
        todayTotals[itemId] += (purchased + soak - consumed);
      }
    }

    // Validate each item's transfer quantity against available stock
    const exceededItems: string[] = [];
    for (const item of items) {
      const { itemId, transferUnit, transferPackage } = item;
      if ((!transferUnit || transferUnit === 0) && (!transferPackage || transferPackage === 0)) {
        continue;
      }
      const pkgSize = packageSizeMap.get(itemId) || 1;
      const totalAvailable = (openingTotals[itemId] || 0) + (todayTotals[itemId] || 0);
      const totalTransfer = ((transferPackage || 0) * pkgSize) + (transferUnit || 0);

      if (totalTransfer > totalAvailable) {
        const matchingItem = allItems.find((i: any) => i._id.toString() === itemId);
        exceededItems.push(matchingItem ? (matchingItem as any).item : itemId);
      }
    }

    if (exceededItems.length > 0) {
      return NextResponse.json(
        { error: `Transfer quantity exceeds available stock for: ${exceededItems.join(", ")}` },
        { status: 400 }
      );
    }

    // --- Create transfer transactions ---
    const results = [];

    for (const item of items) {
      const { itemId, transferUnit, transferPackage } = item;
      
      if ((!transferUnit || transferUnit === 0) && (!transferPackage || transferPackage === 0)) {
        continue; // Skip items with no transfer quantity
      }

      // Create "Transfer Out" transaction (negative from source - as consumed)
      const transferOut = await Transaction.create({
        date: saveDate,
        item: itemId,
        location: fromLocation,
        consumedUnit: transferUnit || 0,
        consumedPackage: transferPackage || 0,
        source: "Stock Transfer",
      });

      // Create "Transfer In" transaction (positive to destination - as purchased)
      const transferIn = await Transaction.create({
        date: saveDate,
        item: itemId,
        location: toLocation,
        purchasedUnit: transferUnit || 0,
        purchasedPackage: transferPackage || 0,
        source: "Stock Transfer",
      });

      results.push({ itemId, transferOut, transferIn });
    }

    return NextResponse.json(
      { message: `Successfully transferred ${results.length} items`, results },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating transfer:", error);
    return NextResponse.json({ error: "Failed to create transfer" }, { status: 500 });
  }
}
