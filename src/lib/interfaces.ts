import { ProductPricing } from "./pricing";
import { PendingCreditMemo } from "./notifications";

export interface Vendor {
  id: string;
  name: string;
  email: string;
}

export interface Invoice {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number | string;
  itemCount: number;
  flaggedCount: number;
  items: unknown[]; // Could be typed further if needed
}

export interface AppSettings {
  priceHikeThreshold: number;   // % above moving avg to flag (default 5)
  contractTolerance: number;    // % above contract price to flag (default 0)
}

export const DEFAULT_SETTINGS: AppSettings = {
  priceHikeThreshold: 5,
  contractTolerance: 0,
};

export interface IVendorRepository {
  getVendorById(id: string): Promise<Vendor | null>;
  saveVendor(vendor: Vendor): Promise<void>;
  getAllVendors(): Promise<Vendor[]>;
}

export interface IInvoiceRepository {
  saveInvoice(invoice: Invoice): Promise<void>;
  getInvoiceById(id: string): Promise<Invoice | null>;
  getAllInvoices(): Promise<Invoice[]>;
}

export interface IPricingRepository {
  getHistoricalPricing(vendorId: string, productSku: string): Promise<ProductPricing | null>;
  appendPrice(vendorId: string, productSku: string, price: number | string, date?: string): Promise<void>;
  getPricingByVendor(vendorId: string): Promise<ProductPricing[]>;
  updateContractPrice(vendorId: string, productSku: string, contractPrice: number): Promise<void>;
}

export interface ICreditMemoRepository {
  getPendingMemos(): Promise<PendingCreditMemo[]>;
  getMemoById(id: string): Promise<PendingCreditMemo | null>;
  saveDraft(memo: PendingCreditMemo): Promise<void>;
  updateMemoStatus(id: string, status: "APPROVED" | "SENT" | "DISMISSED", reason?: string): Promise<void>;
  getAllMemos(): Promise<PendingCreditMemo[]>;
}

export interface AuditLogEntry {
  id: string;
  invoiceId: string;
  lineItemIndex: number;
  vendorId: string;
  itemSku: string;
  billedPrice: number | string;
  referencePrice: number | string;
  referenceType: "contract" | "moving_avg" | "none";
  variancePct: number | string;
  overcharge: number | string;
  flagType: string | null;
  thresholdApplied: string;
  loggedAt: string;
}

export interface IAuditLogRepository {
  logEntry(entry: AuditLogEntry): Promise<void>;
  getEntriesByInvoice(invoiceId: string): Promise<AuditLogEntry[]>;
  getRecentEntries(limit?: number): Promise<AuditLogEntry[]>;
}

export interface ISettingsRepository {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
}

export interface IPasswordRepository {
  getPasswordHash(): Promise<string>;
  setPasswordHash(hash: string): Promise<void>;
}

export interface INotificationService {
  sendCreditMemo(memo: PendingCreditMemo): Promise<boolean>;
}

