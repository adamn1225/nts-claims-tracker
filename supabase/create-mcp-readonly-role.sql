-- ============================================================
-- MCP Read-Only Database Role Setup
-- ============================================================
-- Purpose: Create a secure read-only role for AI tools (MCP)
-- Security: Prevents AI from accidentally modifying data
-- Run this in Supabase SQL Editor or via psql
-- ============================================================

-- Step 1: Create read-only role
CREATE ROLE ai_readonly WITH LOGIN PASSWORD 'change-this-secure-password-123';

-- Step 2: Grant connection permission
GRANT CONNECT ON DATABASE postgres TO ai_readonly;

-- Step 3: Grant usage on public schema
GRANT USAGE ON SCHEMA public TO ai_readonly;

-- Step 4: Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_readonly;

-- Step 5: Grant SELECT on all sequences (needed for viewing table info)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ai_readonly;

-- Step 6: Grant EXECUTE on all functions (read-only functions like get_user_statuses)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ai_readonly;

-- Step 7: Automatically grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO ai_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO ai_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO ai_readonly;

-- Step 8: Explicitly revoke write permissions (extra safety)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM ai_readonly;

-- Step 9: Verify permissions
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'ai_readonly'
ORDER BY table_name, privilege_type;

-- ============================================================
-- After running this, update your MCP config to use:
-- postgresql://ai_readonly:change-this-secure-password-123@db.cuvrgvikdtagkhysxoqo.supabase.co:5432/postgres
-- ============================================================

-- To drop the role later (if needed):
-- DROP ROLE IF EXISTS ai_readonly;
