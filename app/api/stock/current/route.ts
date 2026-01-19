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
      // Group by item and location to sum up the deltas
      {
        $group: {
          _id: { item: "$item", location: "$location" },
          totalUnit: { 
              $sum: { 
                  $subtract: [ 
                      { $add: [ { $ifNull: ["$purchasedUnit", 0] }, { $ifNull: ["$soakUnit", 0] } ] }, 
                      { $ifNull: ["$consumedUnit", 0] } 
                  ] 
              } 
          },
          totalPackage: { 
              $sum: { 
                  $subtract: [ 
                      { $add: [ { $ifNull: ["$purchasedPackage", 0] }, { $ifNull: ["$soakPackage", 0] } ] }, 
                      { $ifNull: ["$consumedPackage", 0] } 
                  ] 
              } 
          },
        },
      },
      
      // Group by item to sum up across locations
      {
        $group: {
          _id: "$_id.item",
          totalUnit: { $sum: "$totalUnit" },
          totalPackage: { $sum: "$totalPackage" },
        },
      },
      
      // Project fields
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
