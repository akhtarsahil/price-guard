import {
  IVendorRepository,
  IInvoiceRepository,
  IPricingRepository,
  ICreditMemoRepository,
  INotificationService,
} from "./interfaces";

import { AntigravityOCRClient } from "./ocr";

// -------------------------------------------------------------
// Service Layer — Dependency Injection Container
// 
// Priority:
//  1. Supabase (cloud) — if SUPABASE env vars are present
//  2. SQLite (local)   — default, zero-config
//
// The app works out of the box with SQLite. No accounts or
// API keys are needed. Supabase is an optional cloud upgrade.
// -------------------------------------------------------------

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);

// Lazy-load implementations to avoid importing native modules in client bundles.
// These factories are only called from server-side code (API routes).

function createRepos() {
  if (hasSupabase) {
    const {
      SupabaseVendorRepository,
      SupabaseInvoiceRepository,
      SupabasePricingRepository,
      SupabaseCreditMemoRepository,
    } = require("./supabase-db");

    return {
      vendorRepo: new SupabaseVendorRepository() as IVendorRepository,
      invoiceRepo: new SupabaseInvoiceRepository() as IInvoiceRepository,
      pricingRepo: new SupabasePricingRepository() as IPricingRepository,
      creditMemoRepo: new SupabaseCreditMemoRepository() as ICreditMemoRepository,
    };
  }

  // Default: SQLite (zero-config local persistence)
  const {
    SQLiteVendorRepository,
    SQLiteInvoiceRepository,
    SQLitePricingRepository,
    SQLiteCreditMemoRepository,
  } = require("./sqlite-db");

  return {
    vendorRepo: new SQLiteVendorRepository() as IVendorRepository,
    invoiceRepo: new SQLiteInvoiceRepository() as IInvoiceRepository,
    pricingRepo: new SQLitePricingRepository() as IPricingRepository,
    creditMemoRepo: new SQLiteCreditMemoRepository() as ICreditMemoRepository,
  };
}

function createNotificationService(): INotificationService {
  if (process.env.RESEND_API_KEY) {
    const { ResendNotificationService } = require("./resend-service");
    return new ResendNotificationService();
  }
  const { ConsoleNotificationService } = require("./in-memory-db");
  return new ConsoleNotificationService();
}

function createOCRClient(): AntigravityOCRClient {
  const { OpenAIVisionClient } = require("./openai-ocr");
  return new OpenAIVisionClient();
}

// Singleton cache — repos are created once on first access
let _repos: ReturnType<typeof createRepos> | null = null;
let _notificationService: INotificationService | null = null;
let _ocrClient: AntigravityOCRClient | null = null;

function getRepos() {
  if (!_repos) _repos = createRepos();
  return _repos;
}

// Public accessors — used by API routes (server-side only)
export function getVendorRepo(): IVendorRepository { return getRepos().vendorRepo; }
export function getInvoiceRepo(): IInvoiceRepository { return getRepos().invoiceRepo; }
export function getPricingRepo(): IPricingRepository { return getRepos().pricingRepo; }
export function getCreditMemoRepo(): ICreditMemoRepository { return getRepos().creditMemoRepo; }

export function getNotificationService(): INotificationService {
  if (!_notificationService) _notificationService = createNotificationService();
  return _notificationService;
}

export function getOCRClient(): AntigravityOCRClient {
  if (!_ocrClient) _ocrClient = createOCRClient();
  return _ocrClient;
}

/** Returns what backend is currently active (for the Setup Wizard UI) */
export function getActiveBackend(): "supabase" | "sqlite" {
  return hasSupabase ? "supabase" : "sqlite";
}
