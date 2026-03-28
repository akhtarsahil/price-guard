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
      vendor_name TEXT DEFAULT '',
      invoice_number TEXT NOT NULL,
      date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      item_count INTEGER DEFAULT 0,
      flagged_count INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS variance_audit_log (
      id TEXT PRIMARY KEY,
      invoice_id TEXT,
      line_item_index INTEGER NOT NULL,
      vendor_id TEXT NOT NULL,
      item_sku TEXT NOT NULL,
      billed_price REAL NOT NULL,
      reference_price REAL NOT NULL,
      reference_type TEXT NOT NULL,
      variance_pct REAL DEFAULT 0,
      overcharge REAL DEFAULT 0,
      flag_type TEXT,
      threshold_applied TEXT NOT NULL,
      logged_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_passwords (
      key TEXT PRIMARY KEY,
      hash TEXT NOT NULL
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

    // Seed mock audit log entries
    const insertAudit = db.prepare(
      `INSERT OR REPLACE INTO variance_audit_log
       (id, invoice_id, line_item_index, vendor_id, item_sku, billed_price,
        reference_price, reference_type, variance_pct, overcharge,
        flag_type, threshold_applied, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    // First invoice (Sysco) - 4 items
    const timeSysco = new Date(Date.now() - 3600000).toISOString();
    insertAudit.run("audit-INV-992384-0", "INV-992384", 0, "v-001", "BEEF-RIBEYE-CHOICE", 14.50, 12.00, "contract", 20.83, 125.00, "CONTRACT_VIOLATION", "Exceeded contract price (0% tolerance)", timeSysco);
    insertAudit.run("audit-INV-992384-1", "INV-992384", 1, "v-001", "CHICKEN-BREAST-BULK", 4.10, 4.00, "moving_avg", 2.50, 0.00, null, "PASS", timeSysco);
    insertAudit.run("audit-INV-992384-2", "INV-992384", 2, "v-001", "FRIES-FROZEN-3/8", 22.00, 22.00, "contract", 0.00, 0.00, null, "PASS", timeSysco);
    insertAudit.run("audit-INV-992384-3", "INV-992384", 3, "v-001", "FLOUR-ALL-PURPOSE", 18.00, 16.50, "moving_avg", 9.09, 15.00, "PRICE_HIKE", "Exceeded 5% moving avg buffer", timeSysco);

    // Second invoice (US Foods) - 4 items
    const timeUSFoods = new Date(Date.now() - 7200000).toISOString();
    insertAudit.run("audit-INV-883719-0", "INV-883719", 0, "v-002", "PRODUCE-AVOCADO-CASE", 65.00, 45.00, "moving_avg", 44.44, 100.00, "PRICE_HIKE", "Exceeded 5% moving avg buffer", timeUSFoods);
    insertAudit.run("audit-INV-883719-1", "INV-883719", 1, "v-002", "PRODUCE-TOMATO-ROMA", 24.00, 24.50, "moving_avg", -2.04, 0.00, null, "PASS", timeUSFoods);
    insertAudit.run("audit-INV-883719-2", "INV-883719", 2, "v-002", "DAIRY-MILK-WHOLE", 4.80, 4.50, "contract", 6.67, 12.00, "CONTRACT_VIOLATION", "Exceeded contract price (0% tolerance)", timeUSFoods);
    insertAudit.run("audit-INV-883719-3", "INV-883719", 3, "v-002", "PAPER-TOWELS-ROLL", 32.00, 31.00, "moving_avg", 3.23, 0.00, null, "PASS", timeUSFoods);
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

  async getAllVendors(): Promise<Vendor[]> {
    const rows = getDb().prepare("SELECT * FROM vendors ORDER BY name ASC").all() as any[];
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email }));
  }
}

export class SQLiteInvoiceRepository implements IInvoiceRepository {
  async saveInvoice(invoice: Invoice): Promise<void> {
    getDb().prepare(
      "INSERT OR REPLACE INTO invoices (id, vendor_id, vendor_name, invoice_number, date, total_amount, item_count, flagged_count, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      invoice.id,
      invoice.vendorId,
      invoice.vendorName,
      invoice.invoiceNumber,
      invoice.date,
      invoice.totalAmount,
      invoice.itemCount,
      invoice.flaggedCount,
      JSON.stringify(invoice.items)
    );
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    const row = getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name || "",
      invoiceNumber: row.invoice_number,
      date: row.date,
      totalAmount: row.total_amount,
      itemCount: row.item_count || 0,
      flaggedCount: row.flagged_count || 0,
      items: JSON.parse(row.items),
    };
  }

  async getAllInvoices(): Promise<Invoice[]> {
    const rows = getDb().prepare(
      "SELECT * FROM invoices ORDER BY date DESC"
    ).all() as any[];
    return rows.map((r) => ({
      id: r.id,
      vendorId: r.vendor_id,
      vendorName: r.vendor_name || "",
      invoiceNumber: r.invoice_number,
      date: r.date,
      totalAmount: r.total_amount,
      itemCount: r.item_count || 0,
      flaggedCount: r.flagged_count || 0,
      items: JSON.parse(r.items),
    }));
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

  async getPricingByVendor(vendorId: string): Promise<ProductPricing[]> {
    const rows = getDb().prepare(
      "SELECT * FROM product_pricing WHERE vendor_id = ? ORDER BY product_sku ASC"
    ).all(vendorId) as any[];
    return rows.map((r) => ({
      vendorId: r.vendor_id,
      productSku: r.product_sku,
      contractPrice: r.contract_price,
      priceHistory: JSON.parse(r.price_history),
    }));
  }

  async updateContractPrice(vendorId: string, productSku: string, contractPrice: number): Promise<void> {
    const existing = await this.getHistoricalPricing(vendorId, productSku);
    const history = existing?.priceHistory || [];
    getDb().prepare(
      "INSERT OR REPLACE INTO product_pricing (vendor_id, product_sku, contract_price, price_history) VALUES (?, ?, ?, ?)"
    ).run(vendorId, productSku, contractPrice, JSON.stringify(history));
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
    getDb().prepare("UPDATE credit_memos SET status = ? WHERE id = ?").run(status, id);
  }

  async getAllMemos(): Promise<PendingCreditMemo[]> {
    const rows = getDb().prepare(
      "SELECT * FROM credit_memos ORDER BY created_at DESC"
    ).all() as any[];
    return rows.map(this.mapRow);
  }
}

export class SQLiteAuditLogRepository implements IAuditLogRepository {
  async logEntry(entry: AuditLogEntry): Promise<void> {
    getDb().prepare(
      `INSERT OR REPLACE INTO variance_audit_log
       (id, invoice_id, line_item_index, vendor_id, item_sku, billed_price,
        reference_price, reference_type, variance_pct, overcharge,
        flag_type, threshold_applied, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.id,
      entry.invoiceId,
      entry.lineItemIndex,
      entry.vendorId,
      entry.itemSku,
      entry.billedPrice,
      entry.referencePrice,
      entry.referenceType,
      entry.variancePct,
      entry.overcharge,
      entry.flagType,
      entry.thresholdApplied,
      entry.loggedAt
    );
  }

  async getEntriesByInvoice(invoiceId: string): Promise<AuditLogEntry[]> {
    const rows = getDb().prepare(
      "SELECT * FROM variance_audit_log WHERE invoice_id = ? ORDER BY line_item_index ASC"
    ).all(invoiceId) as any[];
    return rows.map((r) => ({
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
    const rows = getDb().prepare(
      "SELECT * FROM variance_audit_log ORDER BY logged_at DESC LIMIT ?"
    ).all(limit) as any[];
    return rows.map((r) => ({
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

export class SQLiteSettingsRepository implements ISettingsRepository {
  async getSettings(): Promise<AppSettings> {
    const row = getDb().prepare("SELECT value FROM app_settings WHERE key = 'app'").get() as any;
    if (!row) return { ...DEFAULT_SETTINGS };
    try { return JSON.parse(row.value); } catch { return { ...DEFAULT_SETTINGS }; }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    getDb().prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app', ?)"
    ).run(JSON.stringify(settings));
  }
}

export class SQLitePasswordRepository implements IPasswordRepository {
  async getPasswordHash(): Promise<string> {
    const row = getDb().prepare("SELECT hash FROM app_passwords WHERE key = 'admin'").get() as any;
    if (row) return row.hash;
    if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
    const { hashPassword } = require("./auth");
    return hashPassword("admin");
  }

  async setPasswordHash(hash: string): Promise<void> {
    getDb().prepare(
      "INSERT OR REPLACE INTO app_passwords (key, hash) VALUES ('admin', ?)"
    ).run(hash);
  }
}
