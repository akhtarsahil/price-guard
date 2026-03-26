import { ProductPricing } from "./pricing";
import { ComparisonResult } from "./comparison";
import { PendingCreditMemo } from "./notifications";

export interface Vendor {
  id: string;
  name: string;
  email: string;
}

export interface Invoice {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  items: unknown[]; // Could be typed further if needed
}

export interface IVendorRepository {
  getVendorById(id: string): Promise<Vendor | null>;
  saveVendor(vendor: Vendor): Promise<void>;
  getAllVendors(): Promise<Vendor[]>;
}

export interface IInvoiceRepository {
  saveInvoice(invoice: Invoice): Promise<void>;
  getInvoiceById(id: string): Promise<Invoice | null>;
}

export interface IPricingRepository {
  getHistoricalPricing(vendorId: string, productSku: string): Promise<ProductPricing | null>;
  appendPrice(vendorId: string, productSku: string, price: number, date?: string): Promise<void>;
  getPricingByVendor(vendorId: string): Promise<ProductPricing[]>;
}

export interface ICreditMemoRepository {
  getPendingMemos(): Promise<PendingCreditMemo[]>;
  getMemoById(id: string): Promise<PendingCreditMemo | null>;
  saveDraft(memo: PendingCreditMemo): Promise<void>;
  updateMemoStatus(id: string, status: "APPROVED" | "SENT" | "DISMISSED"): Promise<void>;
  getAllMemos(): Promise<PendingCreditMemo[]>;
}

export interface AuditLogEntry {
  id: string;
  invoiceId: string;
  lineItemIndex: number;
  vendorId: string;
  itemSku: string;
  billedPrice: number;
  referencePrice: number;
  referenceType: "contract" | "moving_avg" | "none";
  variancePct: number;
  overcharge: number;
  flagType: string | null;
  thresholdApplied: string;
  loggedAt: string;
}

export interface IAuditLogRepository {
  logEntry(entry: AuditLogEntry): Promise<void>;
  getEntriesByInvoice(invoiceId: string): Promise<AuditLogEntry[]>;
  getRecentEntries(limit?: number): Promise<AuditLogEntry[]>;
}

export interface INotificationService {
  sendCreditMemo(memo: PendingCreditMemo): Promise<boolean>;
}
