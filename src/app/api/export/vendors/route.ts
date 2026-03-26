import { getVendorRepo, getPricingRepo } from "@/lib/services";
import { calculateMovingAverage } from "@/lib/pricing";

export async function GET() {
  try {
    const vendorRepo = getVendorRepo();
    const pricingRepo = getPricingRepo();

    const vendors = await vendorRepo.getAllVendors();

    const headers = [
      "Vendor ID",
      "Vendor Name",
      "Vendor Email",
      "Product SKU",
      "Contract Price",
      "Moving Average",
      "Variance %",
      "Price History Count",
    ];

    const rows: string[][] = [];

    for (const vendor of vendors) {
      const pricing = await pricingRepo.getPricingByVendor(vendor.id);

      if (pricing.length === 0) {
        rows.push([
          vendor.id,
          `"${vendor.name.replace(/"/g, '""')}"`,
          vendor.email,
          "",
          "",
          "",
          "",
          "0",
        ]);
      } else {
        for (const p of pricing) {
          const avg = Number(calculateMovingAverage(p).toFixed(2));
          const variance =
            p.contractPrice > 0
              ? (((avg - p.contractPrice) / p.contractPrice) * 100).toFixed(1)
              : "N/A";

          rows.push([
            vendor.id,
            `"${vendor.name.replace(/"/g, '""')}"`,
            vendor.email,
            p.productSku,
            p.contractPrice > 0 ? p.contractPrice.toFixed(2) : "",
            avg.toFixed(2),
            variance,
            String(p.priceHistory.length),
          ]);
        }
      }
    }

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=vendors-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  } catch (error) {
    console.error("Failed to export vendors:", error);
    return new Response("Export failed", { status: 500 });
  }
}
