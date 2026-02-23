
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

const ONE_DAY = 60 * 60 * 24;
const THIRTY_DAYS = ONE_DAY * 30;

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { email, password, rememberMe } = await request.json();

    const user = await User.findOne({ email });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret_key_change_me");

    const expiration = rememberMe ? "30d" : "24h";
    const cookieMaxAge = rememberMe ? THIRTY_DAYS : ONE_DAY;

    const token = await new SignJWT({ userId: user._id.toString(), role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expiration)
      .sign(secret);

    const response = NextResponse.json({ message: "Login successful" }, { status: 200 });
    
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieMaxAge,
      path: "/",
    });

    return response;

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

