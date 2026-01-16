
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Location from "@/models/Location";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const location = await Location.findById(id);

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json(location);
  } catch (error) {
    console.error("Failed to fetch location:", error);
    return NextResponse.json({ error: "Failed to fetch location" }, { status: 500 });
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

    const updatedLocation = await Location.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updatedLocation) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json(updatedLocation);
  } catch (error) {
    console.error("Failed to update location:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const deletedLocation = await Location.findByIdAndDelete(id);

    if (!deletedLocation) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Failed to delete location:", error);
    return NextResponse.json({ error: "Failed to delete location" }, { status: 500 });
  }
}
