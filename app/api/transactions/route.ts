import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";

// GET - Fetch transactions (with optional filters)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const location = searchParams.get("location");
    const item = searchParams.get("item");
    
    const query: any = {};
    
    if (date) {
      // Match transactions for the specific date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }
    
    if (location) {
      query.location = location;
    }
    
    if (item) {
      query.item = item;
    }
    
    const transactions = await Transaction.find(query).sort({ date: -1, createdAt: -1 });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

// POST - Create or update a transaction (upsert based on date, item, location)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { date, item, location, countedUnit, countedPackage } = body;
    
    if (!date || !item || !location) {
      return NextResponse.json(
        { error: "Date, item, and location are required" },
        { status: 400 }
      );
    }
    
    // Create date range for the specific day
    const transactionDate = new Date(date);
    transactionDate.setHours(0, 0, 0, 0);
    
    // Upsert: Update if exists for same date/item/location, otherwise create
    const transaction = await Transaction.findOneAndUpdate(
      {
        date: {
          $gte: transactionDate,
          $lt: new Date(transactionDate.getTime() + 24 * 60 * 60 * 1000),
        },
        item,
        location,
      },
      {
        date: transactionDate,
        item,
        location,
        countedUnit: countedUnit !== undefined ? countedUnit : 0,
        countedPackage: countedPackage !== undefined ? countedPackage : 0,
        soakUnit: body.soakUnit !== undefined ? body.soakUnit : 0,
        consumedUnit: body.consumedUnit !== undefined ? body.consumedUnit : 0,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
