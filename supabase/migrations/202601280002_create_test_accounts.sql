-- ==========================================
-- SET TEST ACCOUNT ROLE FLAGS FOR PLAYWRIGHT
-- ==========================================
-- Updates role flags on existing test accounts
-- (Accounts should already exist - created via dashboard)

-- Test Broker Account (regular broker, no special permissions)
UPDATE brokers
SET
  is_admin = FALSE,
  is_manager = FALSE,
  is_remote = FALSE,
  office_location = 'Detroit',
  territory = 'Midwest'
WHERE email = 'test.broker@nts.example.com';

-- Test Admin Account (admin permissions)
UPDATE brokers
SET
  is_admin = TRUE,
  is_manager = FALSE,
  is_remote = FALSE,
  office_location = 'Ft Lauderdale',
  territory = 'All Territories',
  full_name = 'Brian Michael'
WHERE email = 'anoah1225@gmail.com';

-- Test Manager Account (manager permissions)
UPDATE brokers
SET
  is_admin = FALSE,
  is_manager = TRUE,
  is_remote = FALSE,
  office_location = 'Detroit',
  territory = 'Midwest',
  full_name = 'Test Manager'
WHERE email = 'test.manager@nts.example.com';

-- Verify updates
DO $$
DECLARE
  broker_count INT;
  admin_count INT;
  manager_count INT;
BEGIN
  SELECT COUNT(*) INTO broker_count FROM brokers WHERE email = 'test.broker@nts.example.com' AND is_admin = FALSE AND is_manager = FALSE;
  SELECT COUNT(*) INTO admin_count FROM brokers WHERE email = 'test.admin@nts.example.com' AND is_admin = TRUE;
  SELECT COUNT(*) INTO manager_count FROM brokers WHERE email = 'test.manager@nts.example.com' AND is_manager = TRUE;
  
  RAISE NOTICE 'Test account role flags updated:';
  RAISE NOTICE '  Broker: % account(s) with is_admin=false, is_manager=false', broker_count;
  RAISE NOTICE '  Admin: % account(s) with is_admin=true', admin_count;
  RAISE NOTICE '  Manager: % account(s) with is_manager=true', manager_count;
END $$;