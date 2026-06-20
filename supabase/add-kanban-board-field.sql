-- ==========================================
-- MIGRATION: Add on_kanban_board Field
-- ==========================================
-- Purpose: Separate kanban board (focused workspace) from list view (all contacts)
-- Use Case: Brokers curate which contacts appear on their kanban board for focused work

-- Add on_kanban_board column (defaults to false for new contacts)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS on_kanban_board BOOLEAN DEFAULT FALSE;

-- Add index for faster kanban queries
CREATE INDEX IF NOT EXISTS idx_customers_on_kanban_board 
ON customers(broker_id, on_kanban_board) 
WHERE on_kanban_board = TRUE;

-- Migrate existing customers: Put pinned customers on board, others off
-- This preserves current workflow for existing users
UPDATE customers 
SET on_kanban_board = TRUE 
WHERE is_pinned = TRUE;

-- Optional: Set active/won/lost customers to be on board (customize as needed)
-- UPDATE customers 
-- SET on_kanban_board = TRUE 
-- WHERE status IN ('active', 'won');

COMMENT ON COLUMN customers.on_kanban_board IS 'Whether this customer appears on the broker''s kanban board (focused workspace)';
