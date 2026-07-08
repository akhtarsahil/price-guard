import { z } from "zod";
import Decimal from "decimal.js";

// -----------------------------------------------------------------------------
// Database Schema Definitions
// -----------------------------------------------------------------------------
// These schemas can easily be translated to an ORM like Prisma or Drizzle
// Example Prisma equivalent:
// model ProductPricing {
//   id            String   @id @default(cuid())
//   vendorId      String
//   productSku    String
//   contractPrice Float    // The baseline price
//   priceHistory  Json     // Storing an array of the last 5 prices
//   @@unique([vendorId, productSku])
// }

export const PriceEntrySchema = z.object({
  price: z.string().describe("The price paid for the item."),
  date: z.string().describe("ISO date string of when this price was paid."),
});

export type PriceEntry = z.infer<typeof PriceEntrySchema>;

export const ProductPricingSchema = z.object({
  vendorId: z.string().describe("The unique identifier for the vendor."),
  productSku: z.string().describe("The SKU or unique name of the product."),
  contractPrice: z.number().describe("The baseline contracted price for this item."),
  priceHistory: z.array(PriceEntrySchema).max(5).describe("Tracks the last 5 prices paid for each item."),
});

export type ProductPricing = z.infer<typeof ProductPricingSchema>;


// -----------------------------------------------------------------------------
// Analytics Functions
// -----------------------------------------------------------------------------

/**
 * Calculates the Moving Average Price for a given product based on its recent history.
 * 
 * @param pricing Record containing the price history and contract baseline.
 * @returns The calculated moving average as a Decimal instance.
 */
export function calculateMovingAverage(pricing: ProductPricing): Decimal {
  if (!pricing.priceHistory || pricing.priceHistory.length === 0) {
    // If no history exists, we can default to the contract price as the baseline expectation
    return new Decimal(pricing.contractPrice || 0);
  }

  // Ensure we are only calculating the moving average of the *last 5* prices
  // (Schema enforces this, but slicing ensures logic safety if raw data acts weirdly)
  const recentHistory = pricing.priceHistory.slice(-5);
  const sum = recentHistory.reduce((acc, entry) => acc.plus(new Decimal(entry.price)), new Decimal(0));
  
  return sum.dividedBy(recentHistory.length);
}

/**
 * Evaluates the current moving average against the baseline contract price to 
 * detect if the restaurant is overpaying for the specified SKU.
 * 
 * @param pricing Record containing the price history and contract baseline.
 * @returns A breakdown of the moving average, contract price, and variance as exact strings.
 */
export function evaluatePricing(pricing: ProductPricing) {
  const movingAverage = calculateMovingAverage(pricing);
  const contractPrice = new Decimal(pricing.contractPrice || 0);
  
  const variance = movingAverage.minus(contractPrice);
  const variancePercentage = contractPrice.gt(0)
    ? variance.dividedBy(contractPrice).times(100)
    : new Decimal(0);

  return {
    vendorId: pricing.vendorId,
    productSku: pricing.productSku,
    movingAverage: movingAverage.toFixed(2),
    contractPriceBaseline: contractPrice.toFixed(2),
    variance: variance.toFixed(2),
    variancePercentage: variancePercentage.toFixed(2),
    isOverpaying: variancePercentage.gt(0),
  };
}

/**
 * Utility to append a new price to the history array, ensuring it never 
 * exceeds the 5-item rolling window size constraint.
 */
export function appendNewPrice(pricing: ProductPricing, newPrice: number | string | Decimal, date: string = new Date().toISOString()): ProductPricing {
  const exactPriceString = new Decimal(newPrice).toString();
  const newEntry: PriceEntry = { price: exactPriceString, date };
  
  let updatedHistory = [...pricing.priceHistory, newEntry];
  if (updatedHistory.length > 5) {
    // Remove the oldest to maintain a rolling window of 5
    // Assuming history is appended chronologically (oldest at index 0)
    updatedHistory = updatedHistory.slice(updatedHistory.length - 5);
  }

  return {
    ...pricing,
    priceHistory: updatedHistory
  };
}
