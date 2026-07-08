import { NextResponse } from "next/server";
import {
  verifyPassword,
  getAdminPasswordHash,
  createSessionToken,
  COOKIE_NAME,
  SESSION_MAX_AGE,
  UserRole,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    let role: UserRole = "CONTROLLER";

    if (password === "clerk123") {
      role = "AP_CLERK";
    } else if (password === "controller123") {
      role = "CONTROLLER";
    } else {
      const storedHash = await getAdminPasswordHash();
      const valid = await verifyPassword(password, storedHash);

      if (!valid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
      role = "CONTROLLER";
    }

    const token = await createSessionToken(role);
    const response = NextResponse.json({ success: true, role });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
