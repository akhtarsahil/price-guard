import { NextRequest, NextResponse } from "next/server";
import { getOCRClient, getVendorRepo, getPricingRepo, getCreditMemoRepo } from "@/lib/services";
import { extractRestaurantInvoiceData, RestaurantInvoice } from "@/lib/ocr";
import { processInvoiceIngestion, InvoiceItem } from "@/lib/comparison";
import { draftMemosForInvoice } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("invoice") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No invoice file provided" }, { status: 400 });
    }

    // 1. Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Perform OCR Extraction
    const ocrClient = getOCRClient();
    let invoiceData: RestaurantInvoice;
    try {
      invoiceData = await extractRestaurantInvoiceData(buffer, ocrClient);
    } catch (e: any) {
      return NextResponse.json({ error: `OCR Extraction Failed: ${e.message}` }, { status: 500 });
    }

    if (!invoiceData.items || invoiceData.items.length === 0) {
      return NextResponse.json({ error: "No items could be extracted from this invoice." }, { status: 400 });
    }

    // Attempt to lookup or auto-create a vendor ID
    const vendorRepo = getVendorRepo();
    let vendorId = "v-unknown";
    if (invoiceData.vendorName.toLowerCase().includes("sysco")) vendorId = "v-001";
    if (invoiceData.vendorName.toLowerCase().includes("us foods")) vendorId = "v-002";

    // Format OCR extraction into items ready for comparison
    const pricingRepo = getPricingRepo();
    const ingestedItems: InvoiceItem[] = invoiceData.items.map((item) => ({
      vendorId: vendorId,
      productSku: item.itemNameOrSku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount
    }));

    // 3. Compare Prices against Database History
    const ingestionSummary = await processInvoiceIngestion(
      ingestedItems,
      pricingRepo,
      5 // 5% price hike threshold
    );

    // 4. Draft Credit Memos for flagged items
    const creditMemoRepo = getCreditMemoRepo();
    if (ingestionSummary.flaggedItems.length > 0) {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      
      const newDrafts = await draftMemosForInvoice(
        invoiceNumber,
        ingestionSummary.flaggedItems,
        vendorRepo
      );

      for (const draft of newDrafts) {
        await creditMemoRepo.saveDraft(draft);
      }
    }

    return NextResponse.json({ 
      success: true, 
      summary: ingestionSummary,
      draftsGenerated: ingestionSummary.flaggedItems.length > 0 
    });

  } catch (error: any) {
    console.error("API Error processing invoice:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
