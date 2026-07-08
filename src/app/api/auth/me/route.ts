import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (!sessionCookie?.value) {
    return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
  }

  const { valid, role } = await decodeSessionToken(sessionCookie.value);
  if (!valid) {
    return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, role });
}
