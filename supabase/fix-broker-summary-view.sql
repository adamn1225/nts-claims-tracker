-- Fix broker_customer_summary view to use first_name/last_name instead of full_name
-- This aligns with the migration from full_name to first_name/last_name

DROP VIEW IF EXISTS broker_customer_summary CASCADE;

CREATE OR REPLACE VIEW broker_customer_summary AS
SELECT 
  b.id as broker_id,
  CONCAT(b.first_name, ' ', COALESCE(b.last_name, '')) as broker_name,
  b.first_name,
  b.last_name,
  b.email,
  b.office_location,
  b.is_admin,
  b.is_manager,
  COUNT(c.id) as total_customers,
  SUM(CASE WHEN c.status = 'prospect' THEN 1 ELSE 0 END) as prospect_count,
  SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN c.status = 'won' THEN 1 ELSE 0 END) as won_count,
  SUM(CASE WHEN c.status = 'lost' THEN 1 ELSE 0 END) as lost_count,
  ROUND(100.0 * SUM(CASE WHEN c.status = 'won' THEN 1 ELSE 0 END)::NUMERIC / 
    NULLIF(SUM(CASE WHEN c.status IN ('active', 'won', 'lost') THEN 1 ELSE 0 END), 0), 2) as win_rate_pct
FROM brokers b
LEFT JOIN customers c ON b.id = c.broker_id
GROUP BY b.id, b.first_name, b.last_name, b.email, b.office_location, b.is_admin, b.is_manager;

ALTER VIEW broker_customer_summary OWNER TO postgres;
GRANT SELECT ON broker_customer_summary TO authenticated;
