-- Fix for customers that disappeared after status column rename
-- This finds customers whose status doesn't match any existing status

-- Step 1: Find customers with orphaned statuses
SELECT 
  c.id,
  c.business_name,
  c.status as current_status,
  c.broker_id,
  c.on_kanban_board
FROM customers c
LEFT JOIN customer_statuses cs 
  ON LOWER(c.status) = LOWER(cs.name)
  AND c.broker_id = cs.broker_id
WHERE cs.id IS NULL
  AND c.on_kanban_board = true
  AND c.status != 'inbox'  -- Inbox is a protected status without a db entry
ORDER BY c.created_at DESC;

-- Step 2: Fix by setting them to "inbox" (protected status)
-- This moves all orphaned customers to the inbox column where they can be reassigned

-- Option A: Move all orphaned customers to inbox
UPDATE customers 
SET status = 'inbox',
    updated_at = NOW()
WHERE id IN (
  SELECT c.id
  FROM customers c
  LEFT JOIN customer_statuses cs 
    ON LOWER(c.status) = LOWER(cs.name)
    AND c.broker_id = cs.broker_id
  WHERE cs.id IS NULL
    AND c.on_kanban_board = true
    AND c.status != 'inbox'
);

-- Option B: Move specific broker's orphaned customers to inbox
-- UPDATE customers
-- SET status = 'inbox',
--     updated_at = NOW()
-- WHERE broker_id = 'USER_BROKER_ID_HERE'
--   AND status = 'prospect'  -- old status value (lowercase)
--   AND on_kanban_board = true;

-- Option C: Set to first custom status for the broker (if they have custom statuses)
-- UPDATE customers 
-- SET status = (
--   SELECT name 
--   FROM customer_statuses 
--   WHERE broker_id = customers.broker_id 
--   ORDER BY "order" 
--   LIMIT 1
-- ),
--     updated_at = NOW()
-- WHERE id IN (
--   SELECT c.id
--   FROM customers c
--   LEFT JOIN customer_statuses cs 
--     ON LOWER(c.status) = LOWER(cs.name)
--     AND c.broker_id = cs.broker_id
--   WHERE cs.id IS NULL
--     AND c.on_kanban_board = true
--     AND c.status != 'inbox'
-- );
