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
          movingAverage: calculateMovingAverage(p).toFixed(2),
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

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }

    const vendorRepo = getVendorRepo();
    const id = `v-${Date.now()}`;
    const vendor = { id, name, email: email || "" };
    
    await vendorRepo.saveVendor(vendor);
    return NextResponse.json(vendor);
  } catch (error) {
    console.error("Failed to save vendor:", error);
    return NextResponse.json({ error: "Failed to save vendor" }, { status: 500 });
  }
}
