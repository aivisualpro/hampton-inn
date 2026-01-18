
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Item from "@/models/Item";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const item = await Item.findById(id).populate("bundleItems.item");

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch item:", error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const body = await request.json();

    // Ensure numeric fields are actually numbers if passed as strings
    const numericFields = ['costPerPackage', 'restockPackageQty', 'defaultKingRoomQty', 'defaultDoubleQueenQty'];
    for (const field of numericFields) {
      if (body[field] !== undefined) {
         body[field] = Number(body[field]);
      }
    }

    const updatedItem = await Item.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updatedItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Failed to update item:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const deletedItem = await Item.findByIdAndDelete(id);

    if (!deletedItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Failed to delete item:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
