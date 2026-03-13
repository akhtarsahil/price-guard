import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { AntigravityOCRClient, OCRImage } from "./ocr";

export class OpenAIVisionClient implements AntigravityOCRClient {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async extractStructuredData(params: {
    image: OCRImage;
    schema: z.ZodTypeAny;
    prompt: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    
    // Fallback if no API key is present
    if (!this.openai) {
      console.warn("No OPENAI_API_KEY found. Falling back to mock OCR data.");
      return this.mockExtraction(params.schema);
    }

    try {
      const base64Image = params.image.buffer.toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64Image}`; // Assume JPEG/PNG for now

      // @ts-ignore - The OpenAI SDK types for beta parsing can sometimes lag
      const response = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: params.prompt },
              {
                type: "image_url",
                image_url: { url: dataUri },
              },
            ],
          },
        ],
        // @ts-ignore - The OpenAI SDK types for beta parsing can sometimes lag
        response_format: zodResponseFormat(params.schema as any, "invoice_extraction"),
      });

      const extractedData = response.choices[0].message.parsed;

      if (!extractedData) {
        throw new Error("OpenAI failed to return parsed JSON.");
      }

      return {
        success: true,
        data: extractedData
      };

    } catch (error: any) {
      console.error("OpenAI OCR Error:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Provides a realistic dummy response if the user has not configured OpenAI yet,
   * ensuring the app doesn't break out of the box.
   */
  private async mockExtraction(schema: z.ZodTypeAny): Promise<{ success: boolean; data?: any; error?: string }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockInvoice = {
      vendorName: "Sysco Foods (Mock)",
      date: new Date().toISOString().split("T")[0],
      totalAmount: 1850.50,
      items: [
        {
           itemNameOrSku: "BEEF-RIBEYE-CHOICE",
           quantity: 50,
           unitPrice: 16.00, // Trigger a variance (Contract is 12, MA is 12.50)
           totalAmount: 800.00
        },
        {
           itemNameOrSku: "CHICKEN-BREAST-BULK",
           quantity: 100,
           unitPrice: 4.50, // Normal price, might not trigger variance
           totalAmount: 450.00
        }
      ]
    };

    return {
      success: true,
      data: mockInvoice
    };
  }
}
