-- Add show_in_directory flag to brokers table
-- Controls whether a broker appears in the Team Directory and is included in performance metrics
-- Useful for test accounts, executives, coaches, and non-broker staff who need system access
-- but should not appear as active sales agents.

ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS show_in_directory boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN brokers.show_in_directory IS
  'When false, the broker is hidden from the Team Directory and excluded from performance metrics. Useful for test accounts, executives, coaches, and QC staff.';
