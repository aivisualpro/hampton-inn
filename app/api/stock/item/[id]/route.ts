import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import mongoose from "mongoose";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    // Validate Item ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid Item ID" }, { status: 400 });
    }

    // Item ID is stored as String in Transaction, no need to cast to ObjectId for match
    // const itemId = new mongoose.Types.ObjectId(id); 

    const stockByLocation = await Transaction.aggregate([
      // 1. Match transactions for this specific item (match string against string)
      { $match: { item: id } },

      // 2. Group by location to sum up the deltas
      {
        $group: {
          _id: "$location", // Group by location ID (string)
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
          locationId: { $first: "$location" }
        },
      },
      
      // 3a. Convert locationId string to ObjectId for Lookup
      {
        $addFields: {
           locationObjectId: { $toObjectId: "$locationId" }
        }
      },
      
      // 4. Lookup location details to get the name
      {
        $lookup: {
            from: "locations", 
            localField: "locationObjectId", // Use the converted ObjectId
            foreignField: "_id",
            as: "locationDetails"
        }
      },
      
      // 5. Unwind location details
      { $unwind: "$locationDetails" },

      // 6. Project relevant fields
      {
        $project: {
          locationName: "$locationDetails.name",
          locationId: "$locationId",
          totalUnit: 1,
          totalPackage: 1,
          _id: 0,
        },
      },
      
      // 7. Sort by location name
        { $sort: { locationName: 1 } }
    ]);

    return NextResponse.json(stockByLocation);
  } catch (error) {
    console.error("Error fetching stock by location:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}
