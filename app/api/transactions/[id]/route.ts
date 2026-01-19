import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const transaction = await Transaction.findById(id);
    
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 });
  }
}

// PUT - Update a transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    // Import Item model
    const ItemModel = mongoose.models.Item || mongoose.model("Item");

    const body = await request.json();
    
    // We update fields provided in body
    const transaction = await Transaction.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // --- Bundle Logic Cascade ---
    // If the updated transaction is for a bundle item, we must update children transactions
    // Note: We only cascade if unit counts are changed.
    const itemDoc = await ItemModel.findById(transaction.item);
    if (itemDoc && itemDoc.isBundle && itemDoc.bundleItems && itemDoc.bundleItems.length > 0) {
      
       for (const bundleItem of itemDoc.bundleItems) {
        if (!bundleItem.item) continue;

        const qtyMultiplier = bundleItem.quantity || 1;
        
        // Find the specific child transaction
        // It must match date, location, item, AND relatedParentItem
        const filter = {
            date: transaction.date,
            item: bundleItem.item,
            location: transaction.location,
            relatedParentItem: transaction.item
        };
        
        const childUpdateData: any = {};
         // Calculate proportional values based on the PARENT transaction's NEW state
        if (transaction.countedUnit !== undefined) childUpdateData.countedUnit = transaction.countedUnit * qtyMultiplier;
        if (transaction.purchasedUnit !== undefined) childUpdateData.purchasedUnit = transaction.purchasedUnit * qtyMultiplier;
        if (transaction.soakUnit !== undefined) childUpdateData.soakUnit = transaction.soakUnit * qtyMultiplier;
        if (transaction.consumedUnit !== undefined) childUpdateData.consumedUnit = transaction.consumedUnit * qtyMultiplier;

        if (Object.keys(childUpdateData).length > 0) {
             await Transaction.findOneAndUpdate(
                filter,
                { $set: childUpdateData },
                { upsert: true, new: true } // Upsert ensures if child was somehow missing it gets created
            );
        }
      }
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const transaction = await Transaction.findByIdAndDelete(id);

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
