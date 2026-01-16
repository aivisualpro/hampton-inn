import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { jwtVerify } from "jose";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "default_secret_key_change_me"
    );

    const { payload } = await jwtVerify(token, secret);
    
    // Handle both string and object (for backward compatibility with old tokens)
    let userId: string;
    if (typeof payload.userId === "string") {
      userId = payload.userId;
    } else if (payload.userId && typeof payload.userId === "object") {
      // If it's an ObjectId-like object, try to extract the hex string
      const obj = payload.userId as any;
      if (obj.buffer) {
        // Convert buffer to hex string
        const bytes = Object.values(obj.buffer) as number[];
        userId = bytes.map((b: number) => b.toString(16).padStart(2, "0")).join("");
      } else {
        return NextResponse.json({ error: "Invalid token format" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error getting current user:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}
