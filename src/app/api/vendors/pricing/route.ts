import { NextRequest, NextResponse } from "next/server";
import { getPricingRepo } from "@/lib/services";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { vendorId, productSku, contractPrice } = body;

    if (!vendorId || !productSku || contractPrice === undefined) {
      return NextResponse.json(
        { error: "vendorId, productSku, and contractPrice are required" },
        { status: 400 }
      );
    }

    if (typeof contractPrice !== "number" || contractPrice < 0) {
      return NextResponse.json(
        { error: "contractPrice must be a non-negative number" },
        { status: 400 }
      );
    }

    const repo = getPricingRepo();
    await repo.updateContractPrice(vendorId, productSku, contractPrice);

    return NextResponse.json({ success: true, vendorId, productSku, contractPrice });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
