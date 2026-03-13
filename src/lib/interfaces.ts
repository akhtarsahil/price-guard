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
}

export interface IInvoiceRepository {
  saveInvoice(invoice: Invoice): Promise<void>;
  getInvoiceById(id: string): Promise<Invoice | null>;
}

export interface IPricingRepository {
  getHistoricalPricing(vendorId: string, productSku: string): Promise<ProductPricing | null>;
  appendPrice(vendorId: string, productSku: string, price: number, date?: string): Promise<void>;
}

export interface ICreditMemoRepository {
  getPendingMemos(): Promise<PendingCreditMemo[]>;
  getMemoById(id: string): Promise<PendingCreditMemo | null>;
  saveDraft(memo: PendingCreditMemo): Promise<void>;
  updateMemoStatus(id: string, status: "APPROVED" | "SENT" | "DISMISSED"): Promise<void>;
}

export interface INotificationService {
  sendCreditMemo(memo: PendingCreditMemo): Promise<boolean>;
}
