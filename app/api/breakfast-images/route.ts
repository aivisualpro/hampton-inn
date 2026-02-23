import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import cloudinary, { CLOUDINARY_FOLDER } from "@/lib/cloudinary";
import BreakfastImage from "@/models/BreakfastImage";

const MAX_IMAGES_PER_DAY = 3;

// GET - Fetch images for a specific date
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
    }

    const images = await BreakfastImage.find({ date })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({ images, count: images.length, max: MAX_IMAGES_PER_DAY });
  } catch (error) {
    console.error("Error fetching breakfast images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

// POST - Upload a new image
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const date = formData.get("date") as string | null;

    if (!file || !date) {
      return NextResponse.json({ error: "File and date are required" }, { status: 400 });
    }

    // Check current count
    const existingCount = await BreakfastImage.countDocuments({ date });
    if (existingCount >= MAX_IMAGES_PER_DAY) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES_PER_DAY} images per day allowed` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `${CLOUDINARY_FOLDER}/breakfast/${date}`,
          resource_type: "image",
          transformation: [
            { quality: "auto:good", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // Generate thumbnail URL
    const thumbnailUrl = cloudinary.url(result.public_id, {
      width: 200,
      height: 200,
      crop: "fill",
      quality: "auto",
      fetch_format: "auto",
    });

    // Save to database
    const image = await BreakfastImage.create({
      date,
      url: result.secure_url,
      publicId: result.public_id,
      thumbnailUrl,
    });

    return NextResponse.json({ image, count: existingCount + 1, max: MAX_IMAGES_PER_DAY });
  } catch (error) {
    console.error("Error uploading breakfast image:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

// DELETE - Remove an image
export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Image ID is required" }, { status: 400 });
    }

    const image = await BreakfastImage.findById(id);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(image.publicId);
    } catch (e) {
      console.warn("Cloudinary deletion failed (may already be deleted):", e);
    }

    // Delete from database
    await BreakfastImage.findByIdAndDelete(id);

    // Get updated count
    const remainingCount = await BreakfastImage.countDocuments({ date: image.date });

    return NextResponse.json({ success: true, count: remainingCount, max: MAX_IMAGES_PER_DAY });
  } catch (error) {
    console.error("Error deleting breakfast image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
