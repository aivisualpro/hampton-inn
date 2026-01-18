
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Occupancy from "@/models/Occupancy";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
        return NextResponse.json({ error: "Date required" }, { status: 400 });
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    // Be careful with timezones. Store/retrieve consistently.
    // Assuming UI sends YYYY-MM-DD and we want strict match or simplified match
    // For simplicity, let's treat date stored as a Date Object at midnight UTC or similar.
    // However, Mongo dates include time.
    // Let's create a range for the day.
    
    const startOfDay = new Date(Date.UTC(year, month - 1, day));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const record = await Occupancy.findOne({
        date: { $gte: startOfDay, $lte: endOfDay }
    });

    return NextResponse.json(record || { date: dateStr, count: 0 });

  } catch (error) {
    console.error("Error fetching occupancy:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const { date, count } = body;

        if (!date || count === undefined) {
             return NextResponse.json({ error: "Date and count required" }, { status: 400 });
        }

        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        
        // Upsert logic: Check if exists for this day
        // Since we want to update if exists.
        
        const startOfDay = new Date(Date.UTC(year, month - 1, day));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const updated = await Occupancy.findOneAndUpdate(
             { date: { $gte: startOfDay, $lte: endOfDay } },
             { $set: { date: dateObj, count: count } },
             { new: true, upsert: true }
        );

        return NextResponse.json(updated);

    } catch(error) {
        console.error("Error saving occupancy:", error);
        return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }
}
