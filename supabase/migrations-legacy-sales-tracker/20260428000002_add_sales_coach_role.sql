-- Add Sales Coach role flag for coach-specific access model
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS is_sales_coach BOOLEAN DEFAULT FALSE;

-- Backfill nulls to false for consistency
UPDATE brokers
SET is_sales_coach = FALSE
WHERE is_sales_coach IS NULL;
