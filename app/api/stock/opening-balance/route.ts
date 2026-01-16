
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const location = searchParams.get("location");
    
    if (!dateStr || !location) {
      return NextResponse.json({ error: "Date and location required" }, { status: 400 });
    }

    const date = new Date(dateStr);
    // Set to start of the day to ensure specific hour filtering doesn't mess up "before this date" logic
    // Actually we want strictly BEFORE this date's start (00:00:00).
    date.setHours(0, 0, 0, 0);

    const openingBalances = await Transaction.aggregate([
      // 1. Match transactions for filtered location and strictly BEFORE the selected date
      { 
        $match: { 
          location: location,
          date: { $lt: date } 
        } 
      },
      
      // 2. Sort to get the latest transaction first
      { $sort: { date: -1, createdAt: -1 } },
      
      // 3. Group by item to pick the very last transaction
      {
        $group: {
          _id: "$item", // Group by Item ID
          lastCountedUnit: { $first: "$countedUnit" },
        }
      },
      
      // 4. Project cleaner shape
      {
        $project: {
          item: "$_id",
          openingBalance: "$lastCountedUnit",
          _id: 0
        }
      }
    ]);
    
    return NextResponse.json(openingBalances);

  } catch (error) {
    console.error("Error fetching opening balances:", error);
    return NextResponse.json({ error: "Failed to fetch opening balances" }, { status: 500 });
  }
}
