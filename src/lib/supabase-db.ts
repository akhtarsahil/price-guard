import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  IVendorRepository,
  IInvoiceRepository,
  IPricingRepository,
  ICreditMemoRepository,
  IAuditLogRepository,
  ISettingsRepository,
  IPasswordRepository,
  AuditLogEntry,
  Vendor,
  Invoice,
  AppSettings,
  DEFAULT_SETTINGS,
} from "./interfaces";
import { ProductPricing } from "./pricing";
import { PendingCreditMemo } from "./notifications";

export class SupabaseDatabase {
  protected supabase: SupabaseClient | null = null;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }
}

export class SupabaseVendorRepository extends SupabaseDatabase implements IVendorRepository {
  async getVendorById(id: string): Promise<Vendor | null> {
    if (!this.supabase) throw new Error("Supabase internal error");
    const { data, error } = await this.supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return null;
    return data as Vendor;
  }

  async saveVendor(vendor: Vendor): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('vendors').upsert(vendor);
  }

  async getAllVendors(): Promise<Vendor[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('vendors')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data) return [];
    return data as Vendor[];
  }
}

export class SupabaseInvoiceRepository extends SupabaseDatabase implements IInvoiceRepository {
  async saveInvoice(invoice: Invoice): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('invoices').insert({
      id: invoice.id,
      vendor_id: invoice.vendorId,
      invoice_number: invoice.invoiceNumber,
      date: invoice.date,
      total_amount: invoice.totalAmount,
      items: invoice.items
    });
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    if (!this.supabase) return null;
    const { data } = await this.supabase.from('invoices').select('*').eq('id', id).single();
    if (!data) return null;
    
    return {
      id: data.id,
      vendorId: data.vendor_id,
      vendorName: data.vendor_name || "",
      invoiceNumber: data.invoice_number,
      date: data.date,
      totalAmount: data.total_amount,
      itemCount: data.item_count || 0,
      flaggedCount: data.flagged_count || 0,
      items: data.items
    };
  }

  async getAllInvoices(): Promise<Invoice[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .order('date', { ascending: false });
    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      vendorId: r.vendor_id,
      vendorName: r.vendor_name || "",
      invoiceNumber: r.invoice_number,
      date: r.date,
      totalAmount: r.total_amount,
      itemCount: r.item_count || 0,
      flaggedCount: r.flagged_count || 0,
      items: r.items,
    }));
  }
}

export class SupabasePricingRepository extends SupabaseDatabase implements IPricingRepository {
  async getHistoricalPricing(vendorId: string, productSku: string): Promise<ProductPricing | null> {
    if (!this.supabase) return null;
    
    const { data } = await this.supabase
      .from('product_pricing')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('product_sku', productSku)
      .single();

    if (!data) return null;
    
    return {
      vendorId: data.vendor_id,
      productSku: data.product_sku,
      contractPrice: data.contract_price,
      priceHistory: data.price_history || []
    };
  }

  async appendPrice(vendorId: string, productSku: string, price: number, date: string = new Date().toISOString()): Promise<void> {
    if (!this.supabase) return;

    // Fetch existing
    const existing = await this.getHistoricalPricing(vendorId, productSku);
    
    let updatedHistory = existing?.priceHistory || [];
    updatedHistory.push({ price, date });
    
    if (updatedHistory.length > 5) {
      updatedHistory = updatedHistory.slice(-5);
    }

    await this.supabase.from('product_pricing').upsert({
      vendor_id: vendorId,
      product_sku: productSku,
      contract_price: existing?.contractPrice || 0,
      price_history: updatedHistory
    }, { onConflict: 'vendor_id,product_sku' });
  }

  async getPricingByVendor(vendorId: string): Promise<ProductPricing[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('product_pricing')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('product_sku', { ascending: true });
    if (error || !data) return [];
    return data.map((r: any) => ({
      vendorId: r.vendor_id,
      productSku: r.product_sku,
      contractPrice: r.contract_price,
      priceHistory: r.price_history || [],
    }));
  }

  async updateContractPrice(vendorId: string, productSku: string, contractPrice: number): Promise<void> {
    if (!this.supabase) return;
    const existing = await this.getHistoricalPricing(vendorId, productSku);
    await this.supabase.from('product_pricing').upsert({
      vendor_id: vendorId,
      product_sku: productSku,
      contract_price: contractPrice,
      price_history: existing?.priceHistory || [],
    }, { onConflict: 'vendor_id,product_sku' });
  }
}

export class SupabaseCreditMemoRepository extends SupabaseDatabase implements ICreditMemoRepository {
  
  // Helper to map DB snake_case back to CamelCase interface
  private mapToMemo(dbRecord: any): PendingCreditMemo {
    return {
      id: dbRecord.id,
      vendorId: dbRecord.vendor_id,
      vendorName: dbRecord.vendor_name,
      vendorEmail: dbRecord.vendor_email,
      invoiceNumber: dbRecord.invoice_number,
      flaggedItems: dbRecord.flagged_items,
      status: dbRecord.status,
      createdAt: dbRecord.created_at,
      compiledEmailBody: dbRecord.compiled_email_body
    };
  }

  async getPendingMemos(): Promise<PendingCreditMemo[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('credit_memos')
      .select('*')
      .eq('status', 'DRAFT')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(this.mapToMemo);
  }

  async getMemoById(id: string): Promise<PendingCreditMemo | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('credit_memos')
      .select('*')
      .eq('id', id)
      .single();

    if (!data) return null;
    return this.mapToMemo(data);
  }

  async saveDraft(memo: PendingCreditMemo): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('credit_memos').upsert({
      id: memo.id,
      vendor_id: memo.vendorId,
      vendor_name: memo.vendorName,
      vendor_email: memo.vendorEmail,
      invoice_number: memo.invoiceNumber,
      flagged_items: memo.flaggedItems,
      status: memo.status,
      created_at: memo.createdAt,
      compiled_email_body: memo.compiledEmailBody
    });
  }

  async updateMemoStatus(id: string, status: "APPROVED" | "SENT" | "DISMISSED"): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('credit_memos').update({ status }).eq('id', id);
  }

  async getAllMemos(): Promise<PendingCreditMemo[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('credit_memos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(this.mapToMemo);
  }
}

export class SupabaseAuditLogRepository extends SupabaseDatabase implements IAuditLogRepository {
  async logEntry(entry: AuditLogEntry): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('variance_audit_log').insert({
      id: entry.id,
      invoice_id: entry.invoiceId,
      line_item_index: entry.lineItemIndex,
      vendor_id: entry.vendorId,
      item_sku: entry.itemSku,
      billed_price: entry.billedPrice,
      reference_price: entry.referencePrice,
      reference_type: entry.referenceType,
      variance_pct: entry.variancePct,
      overcharge: entry.overcharge,
      flag_type: entry.flagType,
      threshold_applied: entry.thresholdApplied,
      logged_at: entry.loggedAt,
    });
  }

  async getEntriesByInvoice(invoiceId: string): Promise<AuditLogEntry[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('variance_audit_log')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_item_index', { ascending: true });

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      lineItemIndex: r.line_item_index,
      vendorId: r.vendor_id,
      itemSku: r.item_sku,
      billedPrice: r.billed_price,
      referencePrice: r.reference_price,
      referenceType: r.reference_type,
      variancePct: r.variance_pct,
      overcharge: r.overcharge,
      flagType: r.flag_type,
      thresholdApplied: r.threshold_applied,
      loggedAt: r.logged_at,
    }));
  }

  async getRecentEntries(limit: number = 100): Promise<AuditLogEntry[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('variance_audit_log')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      lineItemIndex: r.line_item_index,
      vendorId: r.vendor_id,
      itemSku: r.item_sku,
      billedPrice: r.billed_price,
      referencePrice: r.reference_price,
      referenceType: r.reference_type,
      variancePct: r.variance_pct,
      overcharge: r.overcharge,
      flagType: r.flag_type,
      thresholdApplied: r.threshold_applied,
      loggedAt: r.logged_at,
    }));
  }
}

export class SupabaseSettingsRepository extends SupabaseDatabase implements ISettingsRepository {
  async getSettings(): Promise<AppSettings> {
    if (!this.supabase) return { ...DEFAULT_SETTINGS };
    const { data } = await this.supabase.from('app_settings').select('value').eq('key', 'app').single();
    if (!data) return { ...DEFAULT_SETTINGS };
    try { return JSON.parse(data.value); } catch { return { ...DEFAULT_SETTINGS }; }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('app_settings').upsert({ key: 'app', value: JSON.stringify(settings) });
  }
}

export class SupabasePasswordRepository extends SupabaseDatabase implements IPasswordRepository {
  async getPasswordHash(): Promise<string> {
    if (!this.supabase) {
      if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
      const { hashPassword } = require("./auth");
      return hashPassword("admin");
    }
    const { data } = await this.supabase.from('app_passwords').select('hash').eq('key', 'admin').single();
    if (data) return data.hash;
    if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
    const { hashPassword } = require("./auth");
    return hashPassword("admin");
  }

  async setPasswordHash(hash: string): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('app_passwords').upsert({ key: 'admin', hash });
  }
}
