
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Settings from "@/models/Settings";

export async function GET() {
  await connectToDatabase();
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await connectToDatabase();
  try {
    const body = await req.json();
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(body);
    } else {
        settings.defaultKingRoomCount = body.defaultKingRoomCount ?? settings.defaultKingRoomCount;
        settings.defaultDoubleQueenRoomCount = body.defaultDoubleQueenRoomCount ?? settings.defaultDoubleQueenRoomCount;
        settings.parLevelThreshold = body.parLevelThreshold ?? settings.parLevelThreshold;
    }
    await settings.save();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
