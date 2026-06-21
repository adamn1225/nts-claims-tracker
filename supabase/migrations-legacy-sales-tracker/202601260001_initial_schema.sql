-- ==========================================
-- INITIAL SUPABASE SCHEMA FOR NTS CLAIMS TRACKER
-- ==========================================
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- BROKERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  territory TEXT,
  office_location TEXT,
  is_manager BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for office_location lookups
CREATE INDEX IF NOT EXISTS idx_brokers_office_location 
ON brokers(office_location);

-- Row Level Security (RLS) for brokers
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view their own profile"
  ON brokers FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Managers can view all brokers"
  ON brokers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_manager = TRUE
    )
  );

CREATE POLICY "Admins can view all brokers"
  ON brokers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can manage all brokers"
  ON brokers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ==========================================
-- CUSTOMERS TABLE
-- ==========================================
-- Create sequence for customer reference numbers (starts at 1001)
CREATE SEQUENCE IF NOT EXISTS customer_ref_seq START 1001;

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id TEXT UNIQUE NOT NULL DEFAULT 'NS-' || nextval('customer_ref_seq')::TEXT,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  
  -- Basic Info
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  industry TEXT,
  city TEXT,
  state TEXT,
  
  -- Classification
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'won', 'lost')),
  shipping_frequency TEXT CHECK (shipping_frequency IN ('multiple_per_week', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'yearly', 'other')),
  is_pinned BOOLEAN DEFAULT FALSE,
  pin_order INTEGER,
  
  -- Tracking
  last_contact_date TIMESTAMPTZ,
  next_follow_up_date TIMESTAMPTZ,
  next_follow_up_type TEXT CHECK (next_follow_up_type IN ('call', 'email', 'online_meeting', 'follow_up')),
  estimated_value DECIMAL(10, 2),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_customers_customer_id ON customers(customer_id);
CREATE INDEX idx_customers_broker_id ON customers(broker_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_is_pinned ON customers(is_pinned);
CREATE INDEX idx_customers_next_follow_up ON customers(next_follow_up_date);

-- Row Level Security (RLS) for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view their own customers"
  ON customers FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Managers can view all customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_manager = TRUE
    )
  );

CREATE POLICY "Brokers can insert their own customers"
  ON customers FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers can update their own customers"
  ON customers FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers can delete their own customers"
  ON customers FOR DELETE
  USING (auth.uid() = broker_id);

-- ==========================================
-- TASKS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Task Details
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'follow_up', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'cancelled')),
  
  -- Scheduling
  due_date DATE NOT NULL,
  due_time TIME,
  completed_at TIMESTAMPTZ,
  
  -- Notifications
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tasks_broker_id ON tasks(broker_id);
CREATE INDEX idx_tasks_customer_id ON tasks(customer_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Row Level Security (RLS) for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view their own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Managers can view all tasks"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_manager = TRUE
    )
  );

CREATE POLICY "Brokers can insert their own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers can update their own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers can delete their own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = broker_id);

-- ==========================================
-- CONTACT LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS contact_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  
  -- Log Details
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'quote', 'shipment')),
  subject TEXT NOT NULL,
  notes TEXT,
  outcome TEXT,
  
  -- Timestamp
  contact_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contact_log_customer_id ON contact_log(customer_id);
CREATE INDEX idx_contact_log_broker_id ON contact_log(broker_id);
CREATE INDEX idx_contact_log_contact_date ON contact_log(contact_date DESC);

-- Row Level Security (RLS) for contact_log
ALTER TABLE contact_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view logs for their customers"
  ON contact_log FOR SELECT
  USING (
    auth.uid() = broker_id OR
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = contact_log.customer_id 
      AND customers.broker_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view all contact logs"
  ON contact_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE id = auth.uid() AND is_manager = TRUE
    )
  );

CREATE POLICY "Brokers can insert logs for their customers"
  ON contact_log FOR INSERT
  WITH CHECK (
    auth.uid() = broker_id AND
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = contact_log.customer_id 
      AND customers.broker_id = auth.uid()
    )
  );

-- ==========================================
-- USER PREFERENCES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID UNIQUE NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  
  -- Kanban View Settings
  show_archived BOOLEAN DEFAULT FALSE,
  default_view TEXT DEFAULT 'kanban' CHECK (default_view IN ('kanban', 'list', 'calendar')),
  kanban_column_order JSONB DEFAULT '["prospect", "active", "won", "lost"]',
  
  -- Notification Settings
  email_reminders BOOLEAN DEFAULT TRUE,
  reminder_hours_before INTEGER DEFAULT 24,
  
  -- Display Settings
  items_per_page INTEGER DEFAULT 20,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) for user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = broker_id);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_brokers_updated_at
  BEFORE UPDATE ON brokers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update last_contact_date when contact log is added
CREATE OR REPLACE FUNCTION update_customer_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET last_contact_date = NEW.contact_date
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_last_contact_on_log
  AFTER INSERT ON contact_log
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_last_contact();

-- Automatically mark tasks as overdue
CREATE OR REPLACE FUNCTION mark_overdue_tasks()
RETURNS void AS $$
BEGIN
  UPDATE tasks
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
