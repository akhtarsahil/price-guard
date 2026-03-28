import { NextRequest, NextResponse } from "next/server";
import { getPasswordRepo } from "@/lib/services";
import { hashPassword } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const repo = getPasswordRepo();
    const storedHash = await repo.getPasswordHash();
    const currentHash = await hashPassword(currentPassword);

    if (currentHash !== storedHash) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await repo.setPasswordHash(newHash);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
