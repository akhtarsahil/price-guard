import { NextResponse } from "next/server";
import { getVendorRepo, getPricingRepo } from "@/lib/services";
import { calculateMovingAverage } from "@/lib/pricing";

export async function GET() {
  try {
    const vendorRepo = getVendorRepo();
    const pricingRepo = getPricingRepo();

    const vendors = await vendorRepo.getAllVendors();

    const vendorsWithPricing = await Promise.all(
      vendors.map(async (vendor) => {
        const pricing = await pricingRepo.getPricingByVendor(vendor.id);
        const products = pricing.map((p) => ({
          productSku: p.productSku,
          contractPrice: p.contractPrice,
          movingAverage: Number(calculateMovingAverage(p).toFixed(2)),
          priceHistory: p.priceHistory,
        }));

        return {
          ...vendor,
          trackedSkus: products.length,
          products,
        };
      })
    );

    return NextResponse.json({ vendors: vendorsWithPricing });
  } catch (error) {
    console.error("Failed to fetch vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors" },
      { status: 500 }
    );
  }
}
