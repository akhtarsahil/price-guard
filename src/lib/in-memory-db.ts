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

// Mock Data from original implementation
const MOCK_DRAFTS: PendingCreditMemo[] = [
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

const MOCK_VENDORS: Vendor[] = [
  { id: "v-001", name: "Sysco Foods", email: "accounts@sysco.example.com" },
  { id: "v-002", name: "US Foods", email: "billing@usfoods.example.com" }
];

export class InMemoryVendorRepository implements IVendorRepository {
  private vendors = new Map<string, Vendor>();

  constructor() {
    MOCK_VENDORS.forEach(v => this.vendors.set(v.id, v));
  }

  async getVendorById(id: string): Promise<Vendor | null> {
    return this.vendors.get(id) || null;
  }

  async saveVendor(vendor: Vendor): Promise<void> {
    this.vendors.set(vendor.id, vendor);
  }
}

export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private invoices = new Map<string, Invoice>();

  async saveInvoice(invoice: Invoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) || null;
  }
}

export class InMemoryPricingRepository implements IPricingRepository {
  private pricingData = new Map<string, ProductPricing>();

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
  }
}

export class InMemoryCreditMemoRepository implements ICreditMemoRepository {
  private memos = new Map<string, PendingCreditMemo>();

  constructor() {
    MOCK_DRAFTS.forEach(m => this.memos.set(m.id, m));
  }

  async getPendingMemos(): Promise<PendingCreditMemo[]> {
    return Array.from(this.memos.values()).filter(m => m.status === "DRAFT");
  }

  async getMemoById(id: string): Promise<PendingCreditMemo | null> {
    return this.memos.get(id) || null;
  }

  async saveDraft(memo: PendingCreditMemo): Promise<void> {
    this.memos.set(memo.id, memo);
  }

  async updateMemoStatus(id: string, status: "APPROVED" | "SENT" | "DISMISSED"): Promise<void> {
    const memo = this.memos.get(id);
    if (memo) {
      // In a real DB, you'd just update the status field.
      // Since it's no longer DRAFT, next time `getPendingMemos` is called, it won't be returned.
      // To mimic the UI logic (and for type safety with the existing interface), 
      // we'll cast the status, or just delete it if dismissed.
      if (status === "DISMISSED") {
         this.memos.delete(id);
      } else {
         // Force cast for now, though our interface says "DRAFT"|"APPROVED"|"SENT"
         (memo.status as any) = status;
      }
    }
  }
}

export class ConsoleNotificationService implements INotificationService {
  async sendCreditMemo(memo: PendingCreditMemo): Promise<boolean> {
    console.log(`[Email Sent] To: ${memo.vendorEmail}`);
    console.log(`[Subject] Credit Request - Invoice ${memo.invoiceNumber}`);
    return true; // Simulate success
  }
}
