import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const locationInfo = searchParams.get("location");

    // Build pipeline
    const pipeline: any[] = [];

    // Optional: Filter by location first if provided
    if (locationInfo) {
      pipeline.push({
        $match: { location: locationInfo }
      });
    }

    pipeline.push(
      // 1. Sort by date descending to get latest first
      { $sort: { date: -1, createdAt: -1 } },
      
      // 2. Group by item and location to pick the latest transaction for each pair
      {
        $group: {
          _id: { item: "$item", location: "$location" },
          latestCountedUnit: { $first: "$countedUnit" },
          latestCountedPackage: { $first: "$countedPackage" },
        },
      },
      
      // 3. Group by item to sum up the counts across all locations
      // (If location filter is applied, this effectively just reformats the single result per item)
      {
        $group: {
          _id: "$_id.item",
          totalUnit: { $sum: "$latestCountedUnit" },
          totalPackage: { $sum: "$latestCountedPackage" },
        },
      },
      
      // 4. Project fields for cleaner output
      {
        $project: {
          item: "$_id",
          totalUnit: 1,
          totalPackage: 1,
          _id: 0,
        },
      }
    );

    // Aggregation pipeline to calculate current stock
    const currentStock = await Transaction.aggregate(pipeline);

    return NextResponse.json(currentStock);
  } catch (error) {
    console.error("Error fetching current stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}
