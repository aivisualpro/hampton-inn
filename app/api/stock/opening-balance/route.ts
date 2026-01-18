import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
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

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day)); // Strict UTC Midnight

    const matchQuery: any = {
      date: { $lt: date }
    };

    // Handle Location as String or ObjectId to be safe in Aggregation
    if (mongoose.Types.ObjectId.isValid(location)) {
       matchQuery.location = { $in: [location, new mongoose.Types.ObjectId(location)] };
    } else {
       matchQuery.location = location;
    }

    const openingBalances = await Transaction.aggregate([
      // 1. Match transactions for filtered location and strictly BEFORE the selected date
      { 
        $match: matchQuery
      },
      
      // 2. Sort to get the latest transaction first
      { $sort: { date: -1, createdAt: -1 } },
      
      // 3. Group by item to pick the very last transaction
      {
        $group: {
          _id: "$item", // Group by Item ID
          lastCountedUnit: { $first: "$countedUnit" },
          lastCountedPackage: { $first: "$countedPackage" },
        }
      },
      
      // 4. Project cleaner shape
      {
        $project: {
          item: "$_id",
          openingBalance: "$lastCountedUnit",
          openingBalancePackage: "$lastCountedPackage",
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
