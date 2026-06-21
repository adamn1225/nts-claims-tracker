-- Add index for load search by cargo (commodity/freight description)
-- Enables fast full-text searching for brokers looking up similar loads

-- Create LIKE/ILIKE optimized index on cargo field
CREATE INDEX IF NOT EXISTS idx_completed_orders_cargo ON completed_orders(cargo text_pattern_ops);

COMMENT ON INDEX idx_completed_orders_cargo IS 'Enables fast ILIKE searches on cargo/commodity field for load search feature';
