-- =============================================================================
-- MERGE DUPLICATE BROKER ACCOUNTS
-- =============================================================================
-- Purpose: Some brokers have two auth accounts (SSO @nationwidetransport.com
-- and password @ntslogistics.com). Their data is tied to the SSO UUID.
-- This script migrates everything to the password-login UUID so they can
-- use either login method going forward.
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. For each broker with two accounts, find both UUIDs
--    OLD_UUID = @nationwidetransport.com (SSO) — has all the data
--    NEW_UUID = @ntslogistics.com (password)   — the keeper
-- 3. Replace OLD_UUID_HERE and NEW_UUID_HERE below
-- 4. Run in Supabase SQL Editor
-- 5. Repeat for each duplicate pair
-- 6. After all pairs are done, delete the old auth users in Dashboard → Auth → Users
-- =============================================================================

-- !! REPLACE THESE TWO VALUES BEFORE RUNNING !!
-- old_uuid = SSO account that holds all the data
-- new_uuid = password account that the broker will use going forward

DO $$
DECLARE
  old_uuid UUID := 'OLD_UUID_HERE';
  new_uuid UUID := 'NEW_UUID_HERE';
  n INT;
BEGIN
  RAISE NOTICE 'Starting merge: % → %', old_uuid, new_uuid;

  -- 1. brokers profile row
  UPDATE brokers SET id = new_uuid WHERE id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'brokers: % row(s)', n;

  -- 2. core customer data
  UPDATE customers         SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'customers: % row(s)', n;

  UPDATE tasks             SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'tasks: % row(s)', n;

  UPDATE contact_log       SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'contact_log: % row(s)', n;

  UPDATE customer_statuses SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'customer_statuses: % row(s)', n;

  UPDATE tms_references    SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'tms_references: % row(s)', n;

  -- 3. preferences (UNIQUE — only migrate if new account has none yet)
  UPDATE user_preferences SET broker_id = new_uuid
    WHERE broker_id = old_uuid
      AND NOT EXISTS (SELECT 1 FROM user_preferences WHERE broker_id = new_uuid);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'user_preferences: % row(s)', n;

  -- 4. notifications & templates
  UPDATE scheduled_notifications SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'scheduled_notifications: % row(s)', n;

  UPDATE task_templates   SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'task_templates: % row(s)', n;

  UPDATE email_templates  SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'email_templates: % row(s)', n;

  -- 5. AI & support history
  UPDATE ai_chat_history   SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'ai_chat_history: % row(s)', n;

  UPDATE nts_support_history SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'nts_support_history: % row(s)', n;

  -- 6. GoTo & dialer
  UPDATE goto_connections    SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'goto_connections: % row(s)', n;

  UPDATE power_dialer_events SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'power_dialer_events: % row(s)', n;

  -- 7. collaboration & planning
  UPDATE customer_collaborators SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'customer_collaborators: % row(s)', n;

  UPDATE lane_templates SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'lane_templates: % row(s)', n;

  UPDATE sales_groups SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'sales_groups: % row(s)', n;

  -- 8. permit corrections (two FK columns)
  UPDATE permit_corrections SET reported_by_broker_id = new_uuid WHERE reported_by_broker_id = old_uuid;
  UPDATE permit_corrections SET reviewed_by_broker_id = new_uuid WHERE reviewed_by_broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'permit_corrections: % row(s)', n;

  -- 9. permissions
  UPDATE broker_permissions SET broker_id = new_uuid WHERE broker_id = old_uuid;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'broker_permissions: % row(s)', n;

  RAISE NOTICE '✅ Done. Verify counts below, then delete old auth user % in Supabase Dashboard → Authentication → Users', old_uuid;

END $$;

-- Verify row counts after merge (run separately to confirm)
-- Replace NEW_UUID_HERE with your actual new UUID
/*
SELECT 'customers'         AS tbl, COUNT(*) FROM customers         WHERE broker_id = 'NEW_UUID_HERE'
UNION ALL
SELECT 'tasks',                    COUNT(*) FROM tasks             WHERE broker_id = 'NEW_UUID_HERE'
UNION ALL
SELECT 'contact_log',              COUNT(*) FROM contact_log       WHERE broker_id = 'NEW_UUID_HERE'
UNION ALL
SELECT 'customer_statuses',        COUNT(*) FROM customer_statuses WHERE broker_id = 'NEW_UUID_HERE';
*/
