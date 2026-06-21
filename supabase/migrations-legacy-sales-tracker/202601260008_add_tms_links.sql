-- ==========================================
-- TMS LINKS FOR CUSTOMERS
-- ==========================================
-- Adds a primary TMS account reference to customers and a related table
-- for storing multiple order/quote links per customer.

-- Primary account number on customers
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS tms_account_id TEXT;

-- Ensure uuid generation is available (some environments lack it by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum for link types
DO $$
BEGIN
  CREATE TYPE tms_reference_type AS ENUM ('account', 'order', 'quote');
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- Link table for orders/quotes/accounts
CREATE TABLE IF NOT EXISTS tms_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  type tms_reference_type NOT NULL,
  external_id TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tms_refs_customer ON tms_references(customer_id);
CREATE INDEX IF NOT EXISTS idx_tms_refs_broker_type ON tms_references(broker_id, type);

-- Row Level Security
ALTER TABLE tms_references ENABLE ROW LEVEL SECURITY;

-- Brokers can view links tied to their customers or ones they own
CREATE POLICY "Brokers can view their tms references"
  ON tms_references FOR SELECT
  USING (
    broker_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = tms_references.customer_id
      AND c.broker_id = auth.uid()
    )
  );

-- Brokers insert/manage only their own references
CREATE POLICY "Brokers can insert their tms references"
  ON tms_references FOR INSERT
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can update their tms references"
  ON tms_references FOR UPDATE
  USING (broker_id = auth.uid());

CREATE POLICY "Brokers can delete their tms references"
  ON tms_references FOR DELETE
  USING (broker_id = auth.uid());
