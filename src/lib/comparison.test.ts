import { describe, it, expect } from "vitest";
import { compareItemPricing, InvoiceItem } from "./comparison";
import { ProductPricing } from "./pricing";

const mockRules = {
  contractViolationThresholdPct: 0,
  priceHikeThresholdPct: 5,
};

describe("compareItemPricing - AP Leakage & Variance Detection", () => {
  it("handles scenario with missing historical data cleanly", () => {
    const item: InvoiceItem = {
      itemNameOrSku: "BEEF_RIBEYE",
      quantity: 10,
      unitPrice: "25.00",
      totalAmount: "250.00",
    };

    const result = compareItemPricing(item, null, mockRules);

    expect(result).toEqual({
      itemNameOrSku: "BEEF_RIBEYE",
      quantity: 10,
      billedUnitPrice: "25.00",
      contractPrice: null,
      movingAveragePrice: null,
      variancePercentage: "0.00",
      overchargeAmount: "0.00",
      flagType: null,
      thresholdApplied: "No prior pricing data for reference check.",
    });
  });

  it("passes cleanly on a standard 5-period moving average calculation within threshold", () => {
    const item: InvoiceItem = {
      itemNameOrSku: "FLOUR_50LB",
      quantity: 5,
      unitPrice: "20.40",
      totalAmount: "102.00",
    };

    const historicalData: ProductPricing = {
      vendorId: "VENDOR_001",
      productSku: "FLOUR_50LB",
      contractPrice: 22.00,
      priceHistory: [
        { price: "20.00", date: "2026-06-01" },
        { price: "20.00", date: "2026-06-08" },
        { price: "20.00", date: "2026-06-15" },
        { price: "20.00", date: "2026-06-22" },
        { price: "20.00", date: "2026-06-29" },
      ],
    };

    const result = compareItemPricing(item, historicalData, mockRules);

    expect(result.movingAveragePrice).toBe("20.00");
    expect(result.contractPrice).toBe("22.00");
    expect(result.billedUnitPrice).toBe("20.40");
    expect(result.flagType).toBeNull();
    expect(result.overchargeAmount).toBe("0.00");
  });

  it("flags PRICE_HIKE when price hike exceeds the 5% moving average threshold", () => {
    const item: InvoiceItem = {
      itemNameOrSku: "OLIVE_OIL_CS",
      quantity: 10,
      unitPrice: "110.00",
      totalAmount: "1100.00",
    };

    const historicalData: ProductPricing = {
      vendorId: "VENDOR_001",
      productSku: "OLIVE_OIL_CS",
      contractPrice: 0,
      priceHistory: [
        { price: "100.00", date: "2026-06-01" },
        { price: "100.00", date: "2026-06-08" },
        { price: "100.00", date: "2026-06-15" },
        { price: "100.00", date: "2026-06-22" },
        { price: "100.00", date: "2026-06-29" },
      ],
    };

    const result = compareItemPricing(item, historicalData, mockRules);

    expect(result.movingAveragePrice).toBe("100.00");
    expect(result.billedUnitPrice).toBe("110.00");
    expect(result.variancePercentage).toBe("10.00");
    expect(result.overchargeAmount).toBe("100.00");
    expect(result.flagType).toBe("PRICE_HIKE");
  });

  it("flags CONTRACT_VIOLATION on strict contract price violation with 0% tolerance", () => {
    const item: InvoiceItem = {
      itemNameOrSku: "TOMATO_PASTE",
      quantity: 50,
      unitPrice: "15.75",
      totalAmount: "787.50",
    };

    const historicalData: ProductPricing = {
      vendorId: "VENDOR_002",
      productSku: "TOMATO_PASTE",
      contractPrice: 15.00,
      priceHistory: [
        { price: "15.00", date: "2026-06-01" },
        { price: "15.00", date: "2026-06-08" },
        { price: "15.00", date: "2026-06-15" },
        { price: "15.00", date: "2026-06-22" },
        { price: "15.00", date: "2026-06-29" },
      ],
    };

    const result = compareItemPricing(item, historicalData, mockRules);

    expect(result.flagType).toBe("CONTRACT_VIOLATION");
    expect(result.overchargeAmount).toBe("37.50");
  });
});
