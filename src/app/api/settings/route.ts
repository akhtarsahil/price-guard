import { NextRequest, NextResponse } from "next/server";
import { getSettingsRepo } from "@/lib/services";

export async function GET() {
  const repo = getSettingsRepo();
  const settings = await repo.getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const repo = getSettingsRepo();

    const current = await repo.getSettings();
    const updated = {
      priceHikeThreshold: body.priceHikeThreshold ?? current.priceHikeThreshold,
      contractTolerance: body.contractTolerance ?? current.contractTolerance,
    };

    // Validate ranges
    if (updated.priceHikeThreshold < 0 || updated.priceHikeThreshold > 100) {
      return NextResponse.json({ error: "priceHikeThreshold must be 0-100" }, { status: 400 });
    }
    if (updated.contractTolerance < 0 || updated.contractTolerance > 100) {
      return NextResponse.json({ error: "contractTolerance must be 0-100" }, { status: 400 });
    }

    await repo.saveSettings(updated);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
