-- ==========================================
-- MIGRATION: Make broker_id Nullable for Unassigned Customers
-- ==========================================
-- Purpose: Allow customers to be unassigned (broker_id = NULL) for distribution
-- Use Case: Imported contacts, fired brokers, voluntary reassignment to pool

-- Make broker_id nullable in customers table
ALTER TABLE customers 
ALTER COLUMN broker_id DROP NOT NULL;

-- Make broker_id nullable in tasks table (tasks can also be unassigned)
ALTER TABLE tasks 
ALTER COLUMN broker_id DROP NOT NULL;

-- Make broker_id nullable in notifications table
ALTER TABLE notifications 
ALTER COLUMN broker_id DROP NOT NULL;

-- Note: The RLS policies in fix-reassign-rls-policies.sql already handle NULL broker_id
-- This migration just aligns the schema with the expected behavior
