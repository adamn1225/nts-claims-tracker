-- =============================================================================
-- Add job_title field to customers table
-- =============================================================================
-- Requested by CEO: Track contact's position (President, CEO, Fleet Manager, etc.)
-- This helps identify decision-makers and tailor communication
-- =============================================================================

-- Add job_title column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS job_title text NULL;

-- Add comment for documentation
COMMENT ON COLUMN customers.job_title IS 'Contact job position/title (e.g., President, CEO, Fleet Manager, Logistics Director)';

-- Create index for searching by job title
CREATE INDEX IF NOT EXISTS idx_customers_job_title ON customers(job_title);

-- Optional: Add common job titles as suggestions (not constraints, just for reference)
-- Common freight/logistics titles:
-- - President
-- - CEO / Chief Executive Officer
-- - CFO / Chief Financial Officer  
-- - COO / Chief Operating Officer
-- - VP of Logistics
-- - VP of Transportation
-- - Fleet Manager
-- - Logistics Manager
-- - Transportation Manager
-- - Purchasing Manager
-- - Supply Chain Director
-- - Warehouse Manager
-- - Operations Manager
-- - Dispatch Manager

-- =============================================================================
-- NEXT STEPS:
-- =============================================================================
-- 1. Run this migration in Supabase SQL Editor
-- 2. Run: npm run db:types (to regenerate TypeScript types)
-- 3. Update UI forms to include job_title field
-- =============================================================================
