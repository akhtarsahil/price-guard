import { z } from "zod";

// Hypothetical interface representing the Antigravity OCR Library
export interface OCRImage {
  buffer: Buffer;
}

export interface AntigravityOCRClient {
  extractStructuredData(params: {
    image: OCRImage;
    schema: z.ZodTypeAny;
    prompt: string;
  }): Promise<{ success: boolean; data?: any; error?: string }>;
}

// -------------------------------------------------------------
// 1. Define JSON Schema for extraction
// -------------------------------------------------------------

export const InvoiceItemSchema = z.object({
  itemNameOrSku: z.string().describe("The name or SKU of the restaurant item purchased. Handle tables or list formats."),
  quantity: z.number().describe("The quantity of the item."),
  unitPrice: z.number().describe("The price per unit of the item."),
  totalAmount: z.number().describe("The total price for this line item."),
});

export const RestaurantInvoiceSchema = z.object({
  vendorName: z.string().describe("The name of the restaurant or vendor."),
  date: z.string().describe("The date of the invoice (ISO format YYYY-MM-DD preferred)."),
  items: z.array(InvoiceItemSchema).describe("List of items in the invoice, correctly identifying table columns vs list formats."),
  totalAmount: z.number().describe("The overall total amount of the invoice."),
});

export type RestaurantInvoice = z.infer<typeof RestaurantInvoiceSchema>;

// -------------------------------------------------------------
// 2. OCR Extraction Function
// -------------------------------------------------------------

/**
 * Extracts structured JSON data from a restaurant invoice image.
 * Uses the Antigravity OCR library to parse varying layouts (tables, lists).
 * 
 * @param imageBuffer - The binary buffer of the invoice image
 * @param ocrClient - Instance of Antigravity OCR Client
 * @returns Extracted structured invoice data adhering to the schema
 */
export async function extractRestaurantInvoiceData(
  imageBuffer: Buffer,
  ocrClient: AntigravityOCRClient
): Promise<RestaurantInvoice> {
  try {
    const image: OCRImage = { buffer: imageBuffer };
    
    // Pass the Zod schema and a strong prompt that directs the AI OCR 
    // to handle both table and list formats seamlessly.
    const extractionResult = await ocrClient.extractStructuredData({
      image,
      schema: RestaurantInvoiceSchema,
      prompt: `
        Extract the restaurant invoice details from this image. 
        Pay special attention to line items. The items might be formatted in a structured table 
        with columns for SKU/Name, Quantity, Price, and Total, OR they might be in an unstructured vertical list. 
        Identify the following fields: Vendor Name, Date, Item Name/SKU, Quantity, Unit Price, and Total Amount.
        Return the data strictly matching the provided JSON schema.
      `
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw new Error(`OCR Extraction failed: ${extractionResult.error || "Unknown error"}`);
    }

    // Parse and validate the output to ensure it matches the JSON schema perfectly
    return RestaurantInvoiceSchema.parse(extractionResult.data);
  } catch (error) {
    console.error("Failed to extract invoice data:", error);
    throw error;
  }
}
