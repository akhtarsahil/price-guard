import { ProductPricing, calculateMovingAverage, PriceEntry } from "./pricing";
import { IPricingRepository, IAuditLogRepository, AuditLogEntry } from "./interfaces";

export interface InvoiceItem {
  vendorId: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface ComparisonFlag {
  type: "PRICE_HIKE" | "CONTRACT_VIOLATION";
  message: string;
}

export interface ComparisonResult {
  vendorId: string;
  productSku: string;
  oldMovingAverage: number;
  contractPrice: number;
  newUnitPrice: number;
  variancePercentage: number;
  leakage: number; // The extra cost paid due to the price hike
  flags: ComparisonFlag[];
}

export interface IngestionSummary {
  totalItemsProcessed: number;
  totalLeakage: number;
  flaggedItems: ComparisonResult[];
  auditEntriesLogged: number;
}

/**
 * Compares a single newly ingested invoice item against the store's historical pricing.
 * 
 * @param item The newly ingested item details.
 * @param historicalData The existing pricing data from the database.
 * @param priceHikeThreshold The percentage difference that triggers a PRICE_HIKE flag (default: 5%).
 * @returns A detailed comparison result including flags and leakage amounts.
 */
export function compareItemPricing(
  item: InvoiceItem,
  historicalData: ProductPricing | null,
  priceHikeThreshold: number = 5
): ComparisonResult {
  const result: ComparisonResult = {
    vendorId: item.vendorId,
    productSku: item.productSku,
    oldMovingAverage: 0,
    contractPrice: 0,
    newUnitPrice: item.unitPrice,
    variancePercentage: 0,
    leakage: 0,
    flags: [],
  };

  // If we have no historical data, we can't do a valid comparison yet.
  if (!historicalData) {
    return result;
  }

  result.contractPrice = historicalData.contractPrice;
  result.oldMovingAverage = calculateMovingAverage(historicalData);

  // 1. Check against the Moving Average for general Price Hikes
  if (result.oldMovingAverage > 0) {
    const variance = item.unitPrice - result.oldMovingAverage;
    result.variancePercentage = (variance / result.oldMovingAverage) * 100;

    if (result.variancePercentage > priceHikeThreshold) {
      result.flags.push({
        type: "PRICE_HIKE",
        message: `Price increased by ${result.variancePercentage.toFixed(2)}% compared to the moving average of $${result.oldMovingAverage.toFixed(2)}.`,
      });
      // Leakage is the extra amount paid * quantity
      result.leakage += variance * item.quantity;
    }
  }

  // 2. Check against the strict Contract Price for Violations
  if (result.contractPrice > 0 && item.unitPrice > result.contractPrice) {
    const violationVariance = item.unitPrice - result.contractPrice;
    result.flags.push({
      type: "CONTRACT_VIOLATION",
      message: `Unit price of $${item.unitPrice.toFixed(2)} exceeds the contracted baseline of $${result.contractPrice.toFixed(2)}.`,
    });
    
    if (result.contractPrice > 0) {
       result.leakage = violationVariance * item.quantity;
    }
  }

  return result;
}

/**
 * Determines the human-readable threshold description for the audit log.
 * Called for every line item — flagged or not.
 */
function describeThreshold(
  comparison: ComparisonResult,
  priceHikeThreshold: number
): string {
  const hasContract = comparison.flags.some(f => f.type === "CONTRACT_VIOLATION");
  const hasPriceHike = comparison.flags.some(f => f.type === "PRICE_HIKE");

  if (hasContract) {
    return `Exceeded contract price (0% tolerance)`;
  }
  if (hasPriceHike) {
    return `Exceeded ${priceHikeThreshold}% moving avg buffer`;
  }
  return "PASS";
}

/**
 * Processes an entire list of new invoice items, comparing them against the database,
 * and generates a comprehensive summary of leakage and flags.
 * 
 * Every line item — flagged or not — is logged to the audit trail for full compliance.
 * 
 * @param invoiceItems The list of items extracted from a new invoice.
 * @param pricingRepo The repository used to fetch pricing history.
 * @param priceHikeThreshold Configuration for the price hike alert threshold.
 * @param auditLogRepo Optional audit log repository for compliance trail.
 * @param invoiceId Optional invoice ID for linking audit entries.
 * @returns A summary object detailing total leakage and all flagged results.
 */
export async function processInvoiceIngestion(
  invoiceItems: InvoiceItem[],
  pricingRepo: IPricingRepository,
  priceHikeThreshold: number = 5,
  auditLogRepo?: IAuditLogRepository,
  invoiceId?: string
): Promise<IngestionSummary> {
  const summary: IngestionSummary = {
    totalItemsProcessed: invoiceItems.length,
    totalLeakage: 0,
    flaggedItems: [],
    auditEntriesLogged: 0,
  };

  for (let i = 0; i < invoiceItems.length; i++) {
    const item = invoiceItems[i];
    const historicalData = await pricingRepo.getHistoricalPricing(item.vendorId, item.productSku);
    const comparison = compareItemPricing(item, historicalData, priceHikeThreshold);

    if (comparison.flags.length > 0) {
      summary.flaggedItems.push(comparison);
      summary.totalLeakage += comparison.leakage;
    }

    // Log EVERY line item to the audit trail (flagged or not)
    if (auditLogRepo && invoiceId) {
      const referenceType: "contract" | "moving_avg" | "none" =
        comparison.contractPrice > 0 ? "contract"
        : comparison.oldMovingAverage > 0 ? "moving_avg"
        : "none";

      const referencePrice =
        referenceType === "contract" ? comparison.contractPrice
        : referenceType === "moving_avg" ? comparison.oldMovingAverage
        : 0;

      const entry: AuditLogEntry = {
        id: `audit-${invoiceId}-${i}-${Date.now()}`,
        invoiceId,
        lineItemIndex: i,
        vendorId: item.vendorId,
        itemSku: item.productSku,
        billedPrice: item.unitPrice,
        referencePrice,
        referenceType,
        variancePct: Number(comparison.variancePercentage.toFixed(4)),
        overcharge: Number(comparison.leakage.toFixed(2)),
        flagType: comparison.flags.length > 0
          ? comparison.flags.map(f => f.type).join(", ")
          : null,
        thresholdApplied: describeThreshold(comparison, priceHikeThreshold),
        loggedAt: new Date().toISOString(),
      };

      await auditLogRepo.logEntry(entry);
      summary.auditEntriesLogged++;
    }

    // After analysis is complete, we append the new price to the history
    await pricingRepo.appendPrice(item.vendorId, item.productSku, item.unitPrice);
  }

  // Ensure total leakage is nicely formatted to 2 decimals rounded
  summary.totalLeakage = Number(summary.totalLeakage.toFixed(2));

  return summary;
}

