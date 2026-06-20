-- Find customers with invalid next_follow_up_date values
-- Run this in Supabase SQL Editor to identify problematic records

-- Check for customers with non-null next_follow_up_date that can't be cast to timestamp
SELECT 
    id,
    business_name,
    contact_name,
    next_follow_up_date,
    broker_id
FROM customers
WHERE next_follow_up_date IS NOT NULL
  AND next_follow_up_date::text NOT SIMILAR TO '\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}:\d{2}%';

-- Alternative: Try to find any that fail date validation
SELECT 
    id,
    business_name,
    contact_name,
    next_follow_up_date,
    broker_id,
    CASE 
        WHEN next_follow_up_date::text = '' THEN 'Empty string'
        WHEN next_follow_up_date IS NOT NULL AND NOT (next_follow_up_date::text ~ '^\d{4}-\d{2}-\d{2}') THEN 'Invalid format'
        ELSE 'Valid'
    END as validation_status
FROM customers
WHERE next_follow_up_date IS NOT NULL
ORDER BY validation_status DESC;

-- FIX: Set invalid dates to NULL
-- UNCOMMENT AND RUN THIS AFTER REVIEWING THE RESULTS ABOVE:
-- UPDATE customers
-- SET next_follow_up_date = NULL
-- WHERE next_follow_up_date IS NOT NULL
--   AND next_follow_up_date::text NOT SIMILAR TO '\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}:\d{2}%';

-- Check for tasks with invalid due_date values
SELECT 
    id,
    title,
    due_date,
    broker_id
FROM tasks
WHERE due_date IS NOT NULL
  AND due_date::text NOT SIMILAR TO '\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}:\d{2}%';

-- FIX: Set invalid task dates to NULL
-- UNCOMMENT AND RUN THIS AFTER REVIEWING THE RESULTS ABOVE:
-- UPDATE tasks
-- SET due_date = NULL
-- WHERE due_date IS NOT NULL
--   AND due_date::text NOT SIMILAR TO '\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}:\d{2}%';
