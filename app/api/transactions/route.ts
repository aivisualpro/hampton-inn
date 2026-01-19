import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import mongoose from "mongoose";

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
      // Create UTC date range for the specific day
      // Parse YYYY-MM-DD manually to ensure UTC
      const [year, month, day] = date.split('-').map(Number);
      
      const startOfDay = new Date(Date.UTC(year, month - 1, day));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      
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
    
    // Import Item model dynamically or ensure it is registered
    // We need it to check for bundle status
    const ItemModel = mongoose.models.Item || mongoose.model("Item");

    const body = await request.json();
    const { date, item, location, countedUnit, countedPackage } = body;
    
    if (!date || !item || !location) {
      return NextResponse.json(
        { error: "Date, item, and location are required" },
        { status: 400 }
      );
    }
    
    // Create UTC date for the specific day
    const [year, month, day] = date.split('-').map(Number);
    const transactionDate = new Date(Date.UTC(year, month - 1, day));
    
    // Construct update object dynamically to avoid overwriting existing values with 0 if not provided
    const updateData: any = {
      date: transactionDate,
      item,
      location,
    };

    if (countedUnit !== undefined) updateData.countedUnit = countedUnit;
    if (countedPackage !== undefined) updateData.countedPackage = countedPackage;
    if (body.purchasedUnit !== undefined) updateData.purchasedUnit = body.purchasedUnit;
    if (body.purchasedPackage !== undefined) updateData.purchasedPackage = body.purchasedPackage;
    if (body.soakUnit !== undefined) updateData.soakUnit = body.soakUnit;
    if (body.consumedUnit !== undefined) updateData.consumedUnit = body.consumedUnit;
    if (body.consumedPackage !== undefined) updateData.consumedPackage = body.consumedPackage;

    // Upsert: Update if exists for same date/item/location, otherwise create
    // IMPORTANT: For the MAIN transaction (from the form), relatedParentItem should be null/undefined
    const transaction = await Transaction.findOneAndUpdate(
      {
        date: {
          $gte: transactionDate,
          $lt: new Date(transactionDate.getTime() + 24 * 60 * 60 * 1000),
        },
        item,
        location,
        relatedParentItem: { $exists: false } // Ensures we don't overwrite a child transaction that accidentally matches
      },
      updateData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // --- Bundle Logic ---
    const itemDoc = await ItemModel.findById(item);
    if (itemDoc && itemDoc.isBundle && itemDoc.bundleItems && itemDoc.bundleItems.length > 0) {
      // Logic: Iterate through bundle items and create/update separate transactions for them
      // These transactions will have 'relatedParentItem' set to the bundle item's ID
      
      for (const bundleItem of itemDoc.bundleItems) {
        if (!bundleItem.item) continue;

        const qtyMultiplier = bundleItem.quantity || 1;
        const childUpdateData: any = {
          date: transactionDate,
          item: bundleItem.item,
          location,
          relatedParentItem: item, // Link to parent
        };

        // Calculate proportional values based on the PARENT transaction's current state
        if (transaction.countedUnit !== undefined) childUpdateData.countedUnit = transaction.countedUnit * qtyMultiplier;
        if (transaction.purchasedUnit !== undefined) childUpdateData.purchasedUnit = transaction.purchasedUnit * qtyMultiplier;
        if (transaction.soakUnit !== undefined) childUpdateData.soakUnit = transaction.soakUnit * qtyMultiplier;
        if (transaction.consumedUnit !== undefined) childUpdateData.consumedUnit = transaction.consumedUnit * qtyMultiplier;
        
        // We do NOT map package counts usually, assuming bundle logic applies to Units mostly. 
        // If needed, we can add package logic but usually bundles are defined in Units.

        await Transaction.findOneAndUpdate(
          {
            date: {
              $gte: transactionDate,
              $lt: new Date(transactionDate.getTime() + 24 * 60 * 60 * 1000),
            },
            item: bundleItem.item,
            location,
            relatedParentItem: item // Key differentiator
          },
          childUpdateData,
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );
      }
    }
    
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
