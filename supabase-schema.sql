-- Initial Schema for Price Guard

-- Drop existing tables for clean setup (if needed)
-- DROP TABLE IF EXISTS credit_memos;
-- DROP TABLE IF EXISTS product_pricing;
-- DROP TABLE IF EXISTS invoices;
-- DROP TABLE IF EXISTS vendors;

CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE product_pricing (
  vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  contract_price NUMERIC DEFAULT 0,
  price_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (vendor_id, product_sku)
);

CREATE TABLE credit_memos (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  vendor_email TEXT,
  invoice_number TEXT NOT NULL,
  flagged_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  compiled_email_body TEXT
);
