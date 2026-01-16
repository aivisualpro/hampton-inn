
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Item from "@/models/Item";

export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Validate and format items
    const formattedItems = items.map((item: any) => ({
      item: item.item,
      category: item.category || "Uncategorized",
      subCategory: item.subCategory || "",
      costPerPackage: Number(item.costPerPackage) || 0,
      package: item.package !== undefined && item.package !== null ? String(item.package) : "",
      restockPackageQty: Number(item.restockPackageQty) || 0,
      defaultKingRoomQty: Number(item.defaultKingRoomQty) || 0,
      defaultDoubleQueenQty: Number(item.defaultDoubleQueenQty) || 0,
    }));

    // Use bulkWrite for better performance and to handle upserts if needed, 
    // but simplified insertMany is fine for now. 
    // We'll use insertMany with ordered: false to continue if duplicates error (though we don't have unique constraint on name yet).
    
    // Optional: Clear existing items if requested? For now just append.
    
    const result = await Item.insertMany(formattedItems);

    return NextResponse.json(
      { message: `Successfully imported ${result.length} items` },
      { status: 201 }
    );
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import items" },
      { status: 500 }
    );
  }
}
