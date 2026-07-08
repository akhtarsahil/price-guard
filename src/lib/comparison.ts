import Decimal from "decimal.js";
import { ProductPricing, calculateMovingAverage } from "./pricing";
import { IPricingRepository, IAuditLogRepository, AuditLogEntry } from "./interfaces";

export interface InvoiceItem {
  vendorId?: string;
  productSku?: string;
  itemNameOrSku?: string;
  quantity: number;
  unitPrice: number | string;
  totalAmount: number | string;
}

export interface ComparisonFlag {
  type: "PRICE_HIKE" | "CONTRACT_VIOLATION";
  message: string;
}

export interface ComparisonResult {
  itemNameOrSku?: string;
  quantity?: number;
  billedUnitPrice?: string | number;
  contractPrice: string | number | null;
  movingAveragePrice?: string | number | null;
  variancePercentage: string | number;
  overchargeAmount?: string | number;
  flagType?: "PRICE_HIKE" | "CONTRACT_VIOLATION" | null;
  thresholdApplied?: string;
  // Legacy accessors
  vendorId?: string;
  productSku: string;
  newUnitPrice: number | string;
  oldMovingAverage: number | string;
  leakage: number | string;
  flags: ComparisonFlag[];
}

export interface IngestionSummary {
  totalItemsProcessed: number;
  totalLeakage: string;
  flaggedItems: ComparisonResult[];
  auditEntriesLogged: number;
}

function attachLegacyAccessors(result: any): ComparisonResult {
  Object.defineProperty(result, "leakage", {
    get: () => Number(result.overchargeAmount),
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(result, "productSku", {
    get: () => result.itemNameOrSku,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(result, "newUnitPrice", {
    get: () => Number(result.billedUnitPrice),
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(result, "oldMovingAverage", {
    get: () => Number(result.movingAveragePrice || 0),
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(result, "flags", {
    get: () => result.flagType ? [{ type: result.flagType, message: result.thresholdApplied }] : [],
    enumerable: false,
    configurable: true,
  });
  return result;
}

export function compareItemPricing(
  item: InvoiceItem,
  pricing: ProductPricing | null,
  rulesInput?: {
    contractViolationThresholdPct?: number | string;
    priceHikeThresholdPct?: number | string;
  } | number
): ComparisonResult {
  const rules = typeof rulesInput === "number"
    ? { contractViolationThresholdPct: 0, priceHikeThresholdPct: rulesInput }
    : {
        contractViolationThresholdPct: rulesInput?.contractViolationThresholdPct ?? 0,
        priceHikeThresholdPct: rulesInput?.priceHikeThresholdPct ?? 5,
      };

  const billedPrice = new Decimal(item.unitPrice);
  const itemName = item.itemNameOrSku || item.productSku || "";

  if (!pricing) {
    return attachLegacyAccessors({
      itemNameOrSku: itemName,
      quantity: item.quantity,
      billedUnitPrice: billedPrice.toFixed(2),
      contractPrice: null,
      movingAveragePrice: null,
      variancePercentage: "0.00",
      overchargeAmount: "0.00",
      flagType: null,
      thresholdApplied: "No prior pricing data for reference check.",
    });
  }

  const contractPrice = new Decimal(pricing.contractPrice || 0);
  const movingAvg = calculateMovingAverage(pricing);

  const contractViolationThreshold = new Decimal(rules.contractViolationThresholdPct);
  const priceHikeThreshold = new Decimal(rules.priceHikeThresholdPct);

  // 1. Contract Price Check
  if (contractPrice.gt(0)) {
    const variance = billedPrice.minus(contractPrice);
    const variancePct = variance.dividedBy(contractPrice).times(100);
    const overcharge = variance.times(item.quantity);

    if (variancePct.gt(contractViolationThreshold)) {
      return attachLegacyAccessors({
        itemNameOrSku: itemName,
        quantity: item.quantity,
        billedUnitPrice: billedPrice.toFixed(2),
        contractPrice: contractPrice.toFixed(2),
        movingAveragePrice: movingAvg.gt(0) ? movingAvg.toFixed(2) : null,
        variancePercentage: variancePct.toFixed(2),
        overchargeAmount: overcharge.toFixed(2),
        flagType: "CONTRACT_VIOLATION",
        thresholdApplied: `Billed price $${billedPrice.toFixed(2)} exceeds contract price $${contractPrice.toFixed(2)} by ${variancePct.toFixed(1)}% (Threshold: ${contractViolationThreshold.toFixed(1)}%)`,
      });
    }
  }

  // 2. Moving Average Price Check
  if (movingAvg.gt(0)) {
    const variance = billedPrice.minus(movingAvg);
    const variancePct = variance.dividedBy(movingAvg).times(100);
    const overcharge = variance.times(item.quantity);

    if (variancePct.gt(priceHikeThreshold)) {
      return attachLegacyAccessors({
        itemNameOrSku: itemName,
        quantity: item.quantity,
        billedUnitPrice: billedPrice.toFixed(2),
        contractPrice: contractPrice.gt(0) ? contractPrice.toFixed(2) : null,
        movingAveragePrice: movingAvg.toFixed(2),
        variancePercentage: variancePct.toFixed(2),
        overchargeAmount: overcharge.toFixed(2),
        flagType: "PRICE_HIKE",
        thresholdApplied: `Billed price $${billedPrice.toFixed(2)} exceeds moving average $${movingAvg.toFixed(2)} by ${variancePct.toFixed(1)}% (Threshold: ${priceHikeThreshold.toFixed(1)}%)`,
      });
    }
  }

  return attachLegacyAccessors({
    itemNameOrSku: itemName,
    quantity: item.quantity,
    billedUnitPrice: billedPrice.toFixed(2),
    contractPrice: contractPrice.gt(0) ? contractPrice.toFixed(2) : null,
    movingAveragePrice: movingAvg.gt(0) ? movingAvg.toFixed(2) : null,
    variancePercentage: "0.00",
    overchargeAmount: "0.00",
    flagType: null,
    thresholdApplied: "Pricing complies with both fixed contract and historical moving average thresholds.",
  });
}

export async function processInvoiceIngestion(
  invoiceItems: InvoiceItem[],
  pricingRepo: IPricingRepository,
  rulesInput?: {
    contractViolationThresholdPct?: number | string;
    priceHikeThresholdPct?: number | string;
  } | number,
  auditLogRepo?: IAuditLogRepository,
  invoiceId?: string
): Promise<IngestionSummary> {
  const summary: IngestionSummary = {
    totalItemsProcessed: invoiceItems.length,
    totalLeakage: "0.00",
    flaggedItems: [],
    auditEntriesLogged: 0,
  };

  let totalLeakageDec = new Decimal(0);

  for (let i = 0; i < invoiceItems.length; i++) {
    const item = invoiceItems[i];
    const historicalData = await pricingRepo.getHistoricalPricing(
      item.vendorId || "",
      item.productSku || item.itemNameOrSku || ""
    );
    const comparison = compareItemPricing(item, historicalData, rulesInput);

    if (comparison.flagType !== null) {
      summary.flaggedItems.push(comparison);
      totalLeakageDec = totalLeakageDec.plus(comparison.overchargeAmount ?? 0);
    }

    // Log line item to the audit trail
    if (auditLogRepo && invoiceId) {
      const referenceType: "contract" | "moving_avg" | "none" =
        comparison.flagType === "CONTRACT_VIOLATION" ? "contract"
        : comparison.flagType === "PRICE_HIKE" ? "moving_avg"
        : comparison.contractPrice ? "contract"
        : comparison.movingAveragePrice ? "moving_avg"
        : "none";

      const referencePrice =
        referenceType === "contract" ? (comparison.contractPrice || "0.00")
        : referenceType === "moving_avg" ? (comparison.movingAveragePrice || "0.00")
        : "0.00";

      const entry: AuditLogEntry = {
        id: `audit-${invoiceId}-${i}-${Date.now()}`,
        invoiceId,
        lineItemIndex: i,
        vendorId: item.vendorId || "",
        itemSku: item.productSku || item.itemNameOrSku || "",
        billedPrice: comparison.billedUnitPrice ?? 0,
        referencePrice,
        referenceType,
        variancePct: comparison.variancePercentage,
        overcharge: comparison.overchargeAmount ?? 0,
        flagType: comparison.flagType ?? null,
        thresholdApplied: comparison.thresholdApplied ?? "",
        loggedAt: new Date().toISOString(),
      };

      await auditLogRepo.logEntry(entry);
      summary.auditEntriesLogged++;
    }
  }

  summary.totalLeakage = totalLeakageDec.toFixed(2);
  return summary;
}
