/**
 * SQLite-based repository implementations for Price Guard.
 * 
 * Uses better-sqlite3 for synchronous, zero-config local persistence.
 * The database file lives at data/price-guard.db and tables are
 * auto-created on first connection — no manual SQL setup needed.
 * 
 * IMPORTANT: This module must ONLY be imported from server-side code
 * (API routes). It uses native Node.js modules that cannot run in the browser.
 */

import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import {
  IVendorRepository,
  IInvoiceRepository,
  IPricingRepository,
  ICreditMemoRepository,
  Vendor,
  Invoice,
} from "./interfaces";
import { ProductPricing } from "./pricing";
import { PendingCreditMemo } from "./notifications";

// ---------------------------------------------------------------
// Database Connection (singleton)
// ---------------------------------------------------------------

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "price-guard.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL"); // Better concurrent read performance
    initializeTables(_db);
    seedDefaults(_db);
  }
  return _db;
}

function initializeTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      items TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS product_pricing (
      vendor_id TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      contract_price REAL DEFAULT 0,
      price_history TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (vendor_id, product_sku)
    );

    CREATE TABLE IF NOT EXISTS credit_memos (
      id TEXT PRIMARY KEY,
      vendor_id TEXT,
      vendor_name TEXT NOT NULL,
      vendor_email TEXT,
      invoice_number TEXT NOT NULL,
      flagged_items TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL,
      compiled_email_body TEXT
    );
  `);
}

/**
 * Seed default data if the database is empty (first run experience).
 */
function seedDefaults(db: Database.Database) {
  const vendorCount = db.prepare("SELECT COUNT(*) as count FROM vendors").get() as { count: number };
  
  if (vendorCount.count === 0) {
    const insertVendor = db.prepare("INSERT OR IGNORE INTO vendors (id, name, email) VALUES (?, ?, ?)");
    insertVendor.run("v-001", "Sysco Foods", "accounts@sysco.example.com");
    insertVendor.run("v-002", "US Foods", "billing@usfoods.example.com");

    // Seed some product pricing baselines so the comparison engine works
    const insertPricing = db.prepare(
      "INSERT OR IGNORE INTO product_pricing (vendor_id, product_sku, contract_price, price_history) VALUES (?, ?, ?, ?)"
    );
    insertPricing.run("v-001", "BEEF-RIBEYE-CHOICE", 12.00, JSON.stringify([
      { price: 12.00, date: "2026-01-15" },
      { price: 12.50, date: "2026-02-01" },
      { price: 13.00, date: "2026-02-15" },
    ]));
    insertPricing.run("v-001", "CHICKEN-BREAST-BULK", 4.00, JSON.stringify([
      { price: 4.00, date: "2026-01-15" },
      { price: 4.10, date: "2026-02-01" },
    ]));

    // Seed a sample draft credit memo
    const insertMemo = db.prepare(
      "INSERT OR IGNORE INTO credit_memos (id, vendor_id, vendor_name, vendor_email, invoice_number, flagged_items, status, created_at, compiled_email_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    insertMemo.run(
      "memo-seed-1",
      "v-001",
      "Sysco Foods",
      "accounts@sysco.example.com",
      "INV-992384",
      JSON.stringify([{
        vendorId: "v-001",
        productSku: "BEEF-RIBEYE-CHOICE",
        oldMovingAverage: 12.50,
        contractPrice: 12.00,
        newUnitPrice: 14.50,
        variancePercentage: 20.8,
        leakage: 125.00,
        flags: [{ type: "CONTRACT_VIOLATION", message: "Unit price of $14.50 exceeds the contracted baseline of $12.00." }]
      }]),
      "DRAFT",
      new Date().toISOString(),
      "Subject: Price Discrepancy & Credit Request - Invoice #INV-992384\n\nDear Sysco Foods Team,\n\nWe are writing to you regarding a review of our recent invoice (Invoice #INV-992384). Our automated pricing system flagged some discrepancies between the billed amounts and our established contract..."
    );
    insertMemo.run(
      "memo-seed-2",
      "v-002",
      "US Foods",
      "billing@usfoods.example.com",
      "INV-883719",
      JSON.stringify([{
        vendorId: "v-002",
        productSku: "PRODUCE-AVOCADO-CASE",
        oldMovingAverage: 45.00,
        contractPrice: 0,
        newUnitPrice: 65.00,
        variancePercentage: 44.4,
        leakage: 100.00,
        flags: [{ type: "PRICE_HIKE", message: "Price increased by 44.44% compared to the moving average of $45.00." }]
      }]),
      "DRAFT",
      new Date().toISOString(),
      "Subject: Price Discrepancy & Credit Request - Invoice #INV-883719\n\nDear US Foods Team,\n\nWe are writing to you regarding a review of our recent invoice (Invoice #INV-883719) dated today. Our automated pricing system flagged a significant price hike compared to our trailing moving average..."
    );
  }
}

// ---------------------------------------------------------------
// Repository Implementations
// ---------------------------------------------------------------

export class SQLiteVendorRepository implements IVendorRepository {
  async getVendorById(id: string): Promise<Vendor | null> {
    const row = getDb().prepare("SELECT * FROM vendors WHERE id = ?").get(id) as any;
    if (!row) return null;
    return { id: row.id, name: row.name, email: row.email };
  }

  async saveVendor(vendor: Vendor): Promise<void> {
    getDb().prepare(
      "INSERT OR REPLACE INTO vendors (id, name, email) VALUES (?, ?, ?)"
    ).run(vendor.id, vendor.name, vendor.email);
  }
}

export class SQLiteInvoiceRepository implements IInvoiceRepository {
  async saveInvoice(invoice: Invoice): Promise<void> {
    getDb().prepare(
      "INSERT OR REPLACE INTO invoices (id, vendor_id, invoice_number, date, total_amount, items) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      invoice.id,
      invoice.vendorId,
      invoice.invoiceNumber,
      invoice.date,
      invoice.totalAmount,
      JSON.stringify(invoice.items)
    );
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    const row = getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      vendorId: row.vendor_id,
      invoiceNumber: row.invoice_number,
      date: row.date,
      totalAmount: row.total_amount,
      items: JSON.parse(row.items),
    };
  }
}

export class SQLitePricingRepository implements IPricingRepository {
  async getHistoricalPricing(vendorId: string, productSku: string): Promise<ProductPricing | null> {
    const row = getDb().prepare(
      "SELECT * FROM product_pricing WHERE vendor_id = ? AND product_sku = ?"
    ).get(vendorId, productSku) as any;

    if (!row) return null;
    return {
      vendorId: row.vendor_id,
      productSku: row.product_sku,
      contractPrice: row.contract_price,
      priceHistory: JSON.parse(row.price_history),
    };
  }

  async appendPrice(vendorId: string, productSku: string, price: number, date: string = new Date().toISOString()): Promise<void> {
    const existing = await this.getHistoricalPricing(vendorId, productSku);

    let history = existing?.priceHistory || [];
    history.push({ price, date });
    if (history.length > 5) {
      history = history.slice(-5);
    }

    getDb().prepare(
      "INSERT OR REPLACE INTO product_pricing (vendor_id, product_sku, contract_price, price_history) VALUES (?, ?, ?, ?)"
    ).run(vendorId, productSku, existing?.contractPrice || 0, JSON.stringify(history));
  }
}

export class SQLiteCreditMemoRepository implements ICreditMemoRepository {
  private mapRow(row: any): PendingCreditMemo {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      vendorEmail: row.vendor_email,
      invoiceNumber: row.invoice_number,
      flaggedItems: JSON.parse(row.flagged_items),
      status: row.status,
      createdAt: row.created_at,
      compiledEmailBody: row.compiled_email_body,
    };
  }

  async getPendingMemos(): Promise<PendingCreditMemo[]> {
    const rows = getDb().prepare(
      "SELECT * FROM credit_memos WHERE status = 'DRAFT' ORDER BY created_at DESC"
    ).all() as any[];
    return rows.map(this.mapRow);
  }

  async getMemoById(id: string): Promise<PendingCreditMemo | null> {
    const row = getDb().prepare("SELECT * FROM credit_memos WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async saveDraft(memo: PendingCreditMemo): Promise<void> {
    getDb().prepare(
      "INSERT OR REPLACE INTO credit_memos (id, vendor_id, vendor_name, vendor_email, invoice_number, flagged_items, status, created_at, compiled_email_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      memo.id,
      memo.vendorId,
      memo.vendorName,
      memo.vendorEmail,
      memo.invoiceNumber,
      JSON.stringify(memo.flaggedItems),
      memo.status,
      memo.createdAt,
      memo.compiledEmailBody
    );
  }

  async updateMemoStatus(id: string, status: "APPROVED" | "SENT" | "DISMISSED"): Promise<void> {
    if (status === "DISMISSED") {
      getDb().prepare("DELETE FROM credit_memos WHERE id = ?").run(id);
    } else {
      getDb().prepare("UPDATE credit_memos SET status = ? WHERE id = ?").run(status, id);
    }
  }
}
