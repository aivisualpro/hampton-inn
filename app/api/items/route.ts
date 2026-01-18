
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Item from "@/models/Item";

export async function GET() {
  try {
    await connectToDatabase();
    const items = await Item.find({}).sort({ item: 1 }).populate("bundleItems.item");
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    
    // Ensure numeric fields are actually numbers if passed as strings
    const numericFields = ['costPerPackage', 'restockPackageQty', 'defaultKingRoomQty', 'defaultDoubleQueenQty'];
    for (const field of numericFields) {
      if (body[field] !== undefined) {
         body[field] = Number(body[field]);
      }
    }

    const newItem = await Item.create(body);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create item:", error);
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid payload: 'items' must be an array" },
        { status: 400 }
      );
    }

    const operations = items.map((item: any) => {
        const { _id, ...updateData } = item;
        
        // Ensure numeric fields are numbers
        const numericFields = ['costPerPackage', 'restockPackageQty', 'defaultKingRoomQty', 'defaultDoubleQueenQty'];
        for (const field of numericFields) {
            if (updateData[field] !== undefined) {
                updateData[field] = Number(updateData[field]);
            }
        }

        return {
            updateOne: {
                filter: { _id },
                update: { $set: updateData }
            }
        };
    });

    if (operations.length > 0) {
        await Item.bulkWrite(operations);
    }

    return NextResponse.json({ message: "Items updated successfully", count: operations.length });
  } catch (error) {
    console.error("Failed to bulk update items:", error);
    return NextResponse.json(
      { error: "Failed to bulk update items" },
      { status: 500 }
    );
  }
}
