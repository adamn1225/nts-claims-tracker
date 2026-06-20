-- ============================================
-- CHECK IF DAILY DIGEST TEMPLATE EXISTS
-- ============================================
-- Run this in Supabase SQL Editor to see which system templates you have

-- 1. List all system templates
SELECT 
  'System Templates Check' as section,
  name,
  is_system,
  template_type,
  created_at,
  CASE 
    WHEN name = 'Daily Digest' THEN '✅ Found!'
    ELSE '📧 Other template'
  END as status
FROM email_templates
WHERE is_system = true
ORDER BY name;

-- 2. Specifically check for Daily Digest
SELECT 
  'Daily Digest Specific Check' as section,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Daily Digest template EXISTS'
    ELSE '❌ Daily Digest template NOT FOUND - Migration needs to be run'
  END as result,
  COUNT(*) as count
FROM email_templates
WHERE name = 'Daily Digest' AND is_system = true;

-- 3. Count all templates by type
SELECT 
  'Template Count Summary' as section,
  CASE 
    WHEN is_system THEN 'System Templates'
    ELSE 'Custom Templates'
  END as template_category,
  COUNT(*) as count
FROM email_templates
WHERE is_active = true
GROUP BY is_system;
