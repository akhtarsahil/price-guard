import { ComparisonResult } from "./comparison";
import { IVendorRepository } from "./interfaces";

export interface PendingCreditMemo {
  id: string; // Unique ID for tracking approval status
  vendorId: string;
  vendorName: string; // Assumes we look this up
  vendorEmail: string; // Assumes we have vendor contact info
  invoiceNumber: string;
  flaggedItems: ComparisonResult[];
  status: "DRAFT" | "APPROVED" | "SENT";
  createdAt: string;
  compiledEmailBody?: string;
}

/**
 * Automatically generates a professional draft "Credit Memo" email to a vendor 
 * detailing specific price discrepancies found in a recent invoice.
 * 
 * @param vendorName The name of the vendor.
 * @param invoiceNumber The invoice ID/Number where the flags occurred.
 * @param flags The list of specific price discrepancies and violations.
 * @returns The structured body text for the email to the vendor.
 */
export function generateCreditMemoEmail(
  vendorName: string,
  invoiceNumber: string,
  flags: ComparisonResult[]
): string {
  const currentDate = new Date().toLocaleDateString();

  let emailBody = `Subject: Price Discrepancy & Credit Request - Invoice #${invoiceNumber}

Dear ${vendorName} Team,

I hope this email finds you well.

We are writing to you regarding a review of our recent invoice (Invoice #${invoiceNumber}) dated ${currentDate}. Our automated pricing system flagged some discrepancies between the billed amounts and our historical/contracted pricing baselines.

Please see the breakdown below for the specific items in question:
`;

  let totalCreditRequested = 0;

  flags.forEach((flag) => {
    emailBody += `\n- Item/SKU: ${flag.productSku}\n`;
    emailBody += `  Billed Price: $${flag.newUnitPrice.toFixed(2)}\n`;
    
    if (flag.contractPrice > 0) {
      emailBody += `  Contracted Price: $${flag.contractPrice.toFixed(2)}\n`;
    } else {
      emailBody += `  Historical Moving Average: $${flag.oldMovingAverage.toFixed(2)}\n`;
    }

    emailBody += `  Variance (Leakage): $${flag.leakage.toFixed(2)}\n`;
    
    flag.flags.forEach(f => {
      emailBody += `  * ${f.message}\n`;
    });

    totalCreditRequested += flag.leakage;
  });

  emailBody += `
\nTotal Credit Requested: $${totalCreditRequested.toFixed(2)}

Could you please review these items, confirm the pricing structure moving forward, and issue a credit memo or price correction for the variance amount? 

Thank you for your prompt attention to this matter. Let us know if you need any further clarification.

Best regards,
[Owner/Restaurant Name]
[Contact Information]
`;

  return emailBody;
}

/**
 * Given an array of invoice items that were flagged, group them by Vendor and Invoice Number,
 * and construct the PendingCreditMemo records that an Owner will review.
 */
export async function draftMemosForInvoice(
  invoiceNumber: string,
  flaggedItems: ComparisonResult[],
  vendorRepo: IVendorRepository
): Promise<PendingCreditMemo[]> {
  
  // Group flagged items by vendorId
  const vendorGroups = flaggedItems.reduce((acc, item) => {
    if (!acc[item.vendorId]) acc[item.vendorId] = [];
    acc[item.vendorId].push(item);
    return acc;
  }, {} as Record<string, ComparisonResult[]>);

  const drafts: PendingCreditMemo[] = [];

  for (const [vendorId, items] of Object.entries(vendorGroups)) {
    const vendorDetails = await vendorRepo.getVendorById(vendorId);
    
    // If we can't find the vendor, we still want to draft a memo but maybe with missing info
    const vendorName = vendorDetails?.name || `Unknown Vendor (${vendorId})`;
    const vendorEmail = vendorDetails?.email || "unknown@example.com";
    
    const draft: PendingCreditMemo = {
      id: `memo-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      vendorId,
      vendorName,
      vendorEmail,
      invoiceNumber,
      flaggedItems: items,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      compiledEmailBody: generateCreditMemoEmail(vendorName, invoiceNumber, items)
    };

    drafts.push(draft);
  }

  return drafts;
}
