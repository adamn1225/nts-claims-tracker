-- ==========================================
-- CUSTOMER COLLABORATORS TABLE
-- ==========================================
-- Enables team-based opportunity management without changing ownership model
-- Allows multiple brokers to work together on a customer opportunity
-- Primary owner (broker_id on customers table) retains canonical status
-- Partners gain visibility, can log activities, and receive activity notifications

CREATE TABLE IF NOT EXISTS customer_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'partner' CHECK (role IN ('owner', 'partner')),
  access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('full', 'view_only')),
  invited_by UUID REFERENCES brokers(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: prevent duplicate partnerships per customer
  UNIQUE(customer_id, broker_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_collaborators_customer_id ON customer_collaborators(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_collaborators_broker_id ON customer_collaborators(broker_id);
CREATE INDEX IF NOT EXISTS idx_customer_collaborators_active ON customer_collaborators(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_customer_collaborators_role ON customer_collaborators(role);

-- Row Level Security (RLS) for customer_collaborators
ALTER TABLE customer_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators can view their own collaboration records
CREATE POLICY "Collaborators can view own collaborations"
  ON customer_collaborators FOR SELECT
  USING (
    auth.uid() = broker_id OR
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = customer_collaborators.customer_id 
      AND customers.broker_id = auth.uid()
    )
  );

-- Managers and admins can view all collaborations
CREATE POLICY "Managers and admins can view all collaborations"
  ON customer_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND (is_manager = TRUE OR is_admin = TRUE)
    )
  );

-- Only customer owner can add collaborators
CREATE POLICY "Only customer owner can add collaborators"
  ON customer_collaborators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = customer_collaborators.customer_id 
      AND customers.broker_id = auth.uid()
    )
  );

-- Only customer owner or the collaborator themselves can update their own record (mainly for soft delete/deactivate)
CREATE POLICY "Collaborators can deactivate themselves or owner can manage"
  ON customer_collaborators FOR UPDATE
  USING (
    broker_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = customer_collaborators.customer_id 
      AND customers.broker_id = auth.uid()
    )
  );

-- Only customer owner can delete collaborations
CREATE POLICY "Only customer owner can delete collaborators"
  ON customer_collaborators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = customer_collaborators.customer_id 
      AND customers.broker_id = auth.uid()
    )
  );

-- NOTE: RLS policies for customers, contact_log, and tasks tables are handled separately
-- to avoid circular dependencies. The customer_collaborators table acts as a registry
-- for who can see customer data. Actual access control on those tables is managed
-- through their existing RLS policies (owner checks on broker_id).
