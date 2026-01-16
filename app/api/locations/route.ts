
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Location from "@/models/Location";

export async function GET() {
  try {
    await connectToDatabase();
    const locations = await Location.find({}).sort({ name: 1 });
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Failed to fetch locations:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const newLocation = await Location.create(body);
    return NextResponse.json(newLocation, { status: 201 });
  } catch (error) {
    console.error("Failed to create location:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
