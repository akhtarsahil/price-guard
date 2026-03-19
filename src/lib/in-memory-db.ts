import {
  Vendor,
  IVendorRepository,
  IInvoiceRepository,
  IPricingRepository,
  ICreditMemoRepository,
  INotificationService,
  Invoice
} from "./interfaces";
import { ProductPricing } from "./pricing";
import { PendingCreditMemo } from "./notifications";

// ---------------------------------------------------------------
// Persistence helpers — only active server-side
//
// We use inline dynamic imports to avoid pulling 'fs' or 'path'
// into the client bundle. On the client side these are no-ops.
// ---------------------------------------------------------------

function persistLoad<V>(storeName: string): Map<string, V> | null {
  if (typeof window !== "undefined") return null;
  try {
    const { loadStore } = require("./mock-persistence");
    return loadStore<V>(storeName);
  } catch {
    return null;
  }
}

function persistSave<V>(storeName: string, map: Map<string, V>): void {
  if (typeof window !== "undefined") return;
  try {
    const { saveStore } = require("./mock-persistence");
    saveStore(storeName, map);
  } catch {
    // no-op
  }
}

// ---------------------------------------------------------------
// Seed Data — used when no save file exists
// ---------------------------------------------------------------

const SEED_VENDORS: Vendor[] = [
  { id: "v-001", name: "Sysco Foods", email: "accounts@sysco.example.com" },
  { id: "v-002", name: "US Foods", email: "billing@usfoods.example.com" }
];

const SEED_DRAFTS: PendingCreditMemo[] = [
  {
    id: "memo-1",
    vendorId: "v-001",
    vendorName: "Sysco Foods",
    vendorEmail: "accounts@sysco.example.com",
    invoiceNumber: "INV-992384",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    compiledEmailBody: "Subject: Price Discrepancy & Credit Request - Invoice #INV-992384\n\nDear Sysco Foods Team,\n\nWe are writing to you regarding a review of our recent invoice (Invoice #INV-992384). Our automated pricing system flagged some discrepancies between the billed amounts and our established contract...",
    flaggedItems: [
      {
        vendorId: "v-001",
        productSku: "BEEF-RIBEYE-CHOICE",
        oldMovingAverage: 12.50,
        contractPrice: 12.00,
        newUnitPrice: 14.50,
        variancePercentage: 20.8,
        leakage: 125.00,
        flags: [{ type: "CONTRACT_VIOLATION", message: "Unit price of $14.50 exceeds the contracted baseline of $12.00." }]
      }
    ]
  },
  {
    id: "memo-2",
    vendorId: "v-002",
    vendorName: "US Foods",
    vendorEmail: "billing@usfoods.example.com",
    invoiceNumber: "INV-883719",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    compiledEmailBody: "Subject: Price Discrepancy & Credit Request - Invoice #INV-883719\n\nDear US Foods Team,\n\nWe are writing to you regarding a review of our recent invoice (Invoice #INV-883719) dated today. Our automated pricing system flagged a significant price hike compared to our trailing moving average...",
    flaggedItems: [
      {
        vendorId: "v-002",
        productSku: "PRODUCE-AVOCADO-CASE",
        oldMovingAverage: 45.00,
        contractPrice: 0,
        newUnitPrice: 65.00,
        variancePercentage: 44.4,
        leakage: 100.00,
        flags: [{ type: "PRICE_HIKE", message: "Price increased by 44.44% compared to the moving average of $45.00." }]
      }
    ]
  }
];

// ---------------------------------------------------------------
// Helper: Load a store from disk or seed with defaults
// ---------------------------------------------------------------

function loadOrSeed<V>(storeName: string, seedData: [string, V][]): Map<string, V> {
  const saved = persistLoad<V>(storeName);
  if (saved && saved.size > 0) {
    return saved;
  }
  const map = new Map<string, V>(seedData);
  persistSave(storeName, map);
  return map;
}

// ---------------------------------------------------------------
// PERSISTED IN-MEMORY REPOSITORIES
// ---------------------------------------------------------------

export class InMemoryVendorRepository implements IVendorRepository {
  private vendors: Map<string, Vendor>;

  constructor() {
    this.vendors = loadOrSeed("vendors", SEED_VENDORS.map(v => [v.id, v]));
  }

  async getVendorById(id: string): Promise<Vendor | null> {
    return this.vendors.get(id) || null;
  }

  async saveVendor(vendor: Vendor): Promise<void> {
    this.vendors.set(vendor.id, vendor);
    persistSave("vendors", this.vendors);
  }
}

export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private invoices: Map<string, Invoice>;

  constructor() {
    this.invoices = loadOrSeed("invoices", []);
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
    persistSave("invoices", this.invoices);
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) || null;
  }
}

export class InMemoryPricingRepository implements IPricingRepository {
  private pricingData: Map<string, ProductPricing>;

  constructor() {
    this.pricingData = loadOrSeed("pricing", []);
  }

  async getHistoricalPricing(vendorId: string, productSku: string): Promise<ProductPricing | null> {
    const key = `${vendorId}-${productSku}`;
    return this.pricingData.get(key) || null;
  }

  async appendPrice(vendorId: string, productSku: string, price: number, date: string = new Date().toISOString()): Promise<void> {
    const key = `${vendorId}-${productSku}`;
    let existing = this.pricingData.get(key);
    
    if (!existing) {
      existing = { vendorId, productSku, contractPrice: 0, priceHistory: [] };
    }
    
    existing.priceHistory.push({ price, date });
    if (existing.priceHistory.length > 5) {
      existing.priceHistory = existing.priceHistory.slice(-5);
    }
    
    this.pricingData.set(key, existing);
    persistSave("pricing", this.pricingData);
  }
}

export class InMemoryCreditMemoRepository implements ICreditMemoRepository {
  private memos: Map<string, PendingCreditMemo>;

  constructor() {
    this.memos = loadOrSeed("creditMemos", SEED_DRAFTS.map(m => [m.id, m]));
  }

  async getPendingMemos(): Promise<PendingCreditMemo[]> {
    return Array.from(this.memos.values()).filter(m => m.status === "DRAFT");
  }

  async getMemoById(id: string): Promise<PendingCreditMemo | null> {
    return this.memos.get(id) || null;
  }

  async saveDraft(memo: PendingCreditMemo): Promise<void> {
    this.memos.set(memo.id, memo);
    persistSave("creditMemos", this.memos);
  }

  async updateMemoStatus(id: string, status: "APPROVED" | "SENT" | "DISMISSED"): Promise<void> {
    const memo = this.memos.get(id);
    if (memo) {
      if (status === "DISMISSED") {
         this.memos.delete(id);
      } else {
         (memo.status as any) = status;
      }
      persistSave("creditMemos", this.memos);
    }
  }
}

export class ConsoleNotificationService implements INotificationService {
  async sendCreditMemo(memo: PendingCreditMemo): Promise<boolean> {
    console.log(`[Email Sent] To: ${memo.vendorEmail}`);
    console.log(`[Subject] Credit Request - Invoice ${memo.invoiceNumber}`);
    return true;
  }
}
