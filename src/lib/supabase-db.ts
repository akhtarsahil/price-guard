import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  IVendorRepository,
  IInvoiceRepository,
  IPricingRepository,
  ICreditMemoRepository,
  Vendor,
  Invoice
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
      invoiceNumber: data.invoice_number,
      date: data.date,
      totalAmount: data.total_amount,
      items: data.items
    };
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

    if (status === "DISMISSED") {
      // Hard delete for dismissals, or could just set status
      await this.supabase.from('credit_memos').delete().eq('id', id);
    } else {
      await this.supabase.from('credit_memos').update({ status }).eq('id', id);
    }
  }
}
