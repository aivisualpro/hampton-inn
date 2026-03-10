import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Location from "@/models/Location";

// POST - Set a location as the Purchase Location
export async function POST() {
  try {
    await connectToDatabase();
    
    // First, clear any existing Purchase Location flag
    await Location.updateMany(
      { isPurchaseLocation: true },
      { $set: { isPurchaseLocation: false } }
    );
    
    // Find the "Purchase Location" by name and mark it
    const purchaseLocation = await Location.findOneAndUpdate(
      { name: { $regex: /^Purchase Location$/i } },
      { $set: { isPurchaseLocation: true } },
      { new: true }
    );
    
    if (!purchaseLocation) {
      // Create it if it doesn't exist
      const newLocation = await Location.create({
        name: "Purchase Location",
        description: "Central purchase receiving location. All purchased stock arrives here before being transferred to other locations.",
        isPurchaseLocation: true,
        items: [],
      });
      return NextResponse.json(newLocation, { status: 201 });
    }
    
    return NextResponse.json(purchaseLocation);
  } catch (error) {
    console.error("Failed to set purchase location:", error);
    return NextResponse.json({ error: "Failed to set purchase location" }, { status: 500 });
  }
}

// GET - Get the purchase location
export async function GET() {
  try {
    await connectToDatabase();
    
    const purchaseLocation = await Location.findOne({ isPurchaseLocation: true });
    
    if (!purchaseLocation) {
      return NextResponse.json({ error: "Purchase Location not found" }, { status: 404 });
    }
    
    return NextResponse.json(purchaseLocation);
  } catch (error) {
    console.error("Failed to fetch purchase location:", error);
    return NextResponse.json({ error: "Failed to fetch purchase location" }, { status: 500 });
  }
}
