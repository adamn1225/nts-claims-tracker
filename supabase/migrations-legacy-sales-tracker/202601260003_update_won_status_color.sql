-- ==========================================
-- Update 'Won' status color from purple to amber
-- ==========================================

BEGIN;

-- Update only statuses named 'Won' currently using 'purple'
UPDATE customer_statuses
SET color = 'amber', updated_at = NOW()
WHERE LOWER(name) = 'won'
  AND color = 'purple';

-- Verify the change
SELECT id, office_location, name, color, "order", is_system
FROM customer_statuses
WHERE LOWER(name) = 'won'
ORDER BY office_location, "order";

COMMIT;
