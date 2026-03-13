import { NextRequest, NextResponse } from "next/server";
import { ocrClient, vendorRepo, pricingRepo, creditMemoRepo } from "@/lib/services";
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

    // 2. Perform OCR Extraction using our abstract OCR client
    // Note: If OpenAI keys aren't present, ocrClient might be a mock that returns fixed data
    // for demonstration purposes. We'll build the mock next.
    let invoiceData: RestaurantInvoice;
    try {
      invoiceData = await extractRestaurantInvoiceData(buffer, ocrClient);
    } catch (e: any) {
      return NextResponse.json({ error: `OCR Extraction Failed: ${e.message}` }, { status: 500 });
    }

    if (!invoiceData.items || invoiceData.items.length === 0) {
      return NextResponse.json({ error: "No items could be extracted from this invoice." }, { status: 400 });
    }

    // Attempt to lookup or auto-create a vendor ID simply based on the name extracted.
    // In a full production app, you might do a fuzzy search against the vendor database.
    // For this prototype, if we don't recognize the exact string, we simulate finding or creating one.
    let vendorId = "v-unknown";
    if (invoiceData.vendorName.toLowerCase().includes("sysco")) vendorId = "v-001";
    if (invoiceData.vendorName.toLowerCase().includes("us foods")) vendorId = "v-002";

    // Format OCR extraction into items ready for comparison
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
    if (ingestionSummary.flaggedItems.length > 0) {
      // Look up a mock invoice number, or use a date-based one if OCR missed it
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      
      const newDrafts = await draftMemosForInvoice(
        invoiceNumber,
        ingestionSummary.flaggedItems,
        vendorRepo
      );

      // Save drafts to our database / repository
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
