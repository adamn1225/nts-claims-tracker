-- Add a per-broker IANA timezone preference.
--
-- NTS is a nationwide company with offices across the country and brokers who
-- travel, so scheduling (daily digest send time, task reminders, overdue
-- calculations) must respect each broker's own timezone rather than a single
-- hardcoded Eastern time.
--
-- Semantics:
--   * timezone holds an IANA name (e.g. 'America/New_York', 'America/Chicago').
--   * digest_time and task due_time are interpreted as wall-clock times in this
--     timezone. Absolute timestamps remain stored in UTC.
--   * Default is 'America/New_York' so existing brokers (who were all treated as
--     Eastern) keep their current behavior with no change.

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

COMMENT ON COLUMN user_preferences.timezone IS
  'IANA timezone (e.g. America/New_York) used to interpret digest_time and task due times for this broker.';
