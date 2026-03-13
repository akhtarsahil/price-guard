import {
  IVendorRepository,
  IInvoiceRepository,
  IPricingRepository,
  ICreditMemoRepository,
  INotificationService,
} from "./interfaces";

import { AntigravityOCRClient } from "./ocr";

// -------------------------------------------------------------
// IN-MEMORY / MOCK IMPLEMENTATIONS
// -------------------------------------------------------------
import {
  InMemoryVendorRepository,
  InMemoryInvoiceRepository,
  InMemoryPricingRepository,
  InMemoryCreditMemoRepository,
  ConsoleNotificationService
} from "./in-memory-db";

// -------------------------------------------------------------
// REAL EXTERNAL IMPLEMENTATIONS
// -------------------------------------------------------------
import { 
  SupabaseVendorRepository,
  SupabaseInvoiceRepository,
  SupabasePricingRepository,
  SupabaseCreditMemoRepository
} from "./supabase-db";
import { ResendNotificationService } from "./resend-service";
import { OpenAIVisionClient } from "./openai-ocr";

/**
 * Dependency Injection Container / Service Locator
 * 
 * Automatically switches to a real backend if API keys are present.
 * Otherwise, gracefully degrades to In-Memory mocks so the app runs smoothly out-of-the-box.
 */

const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const vendorRepo: IVendorRepository = hasSupabase ? new SupabaseVendorRepository() : new InMemoryVendorRepository();
export const invoiceRepo: IInvoiceRepository = hasSupabase ? new SupabaseInvoiceRepository() : new InMemoryInvoiceRepository();
export const pricingRepo: IPricingRepository = hasSupabase ? new SupabasePricingRepository() : new InMemoryPricingRepository();
export const creditMemoRepo: ICreditMemoRepository = hasSupabase ? new SupabaseCreditMemoRepository() : new InMemoryCreditMemoRepository();

export const notificationService: INotificationService = process.env.RESEND_API_KEY 
  ? new ResendNotificationService() 
  : new ConsoleNotificationService();

export const ocrClient: AntigravityOCRClient = new OpenAIVisionClient(); // OpenAIVisionClient handles its own fallback inside based on API key

