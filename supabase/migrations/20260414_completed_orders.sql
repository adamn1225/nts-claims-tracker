-- Create completed_orders table for carrier matching historical data
-- Replaces 31MB JSON file with indexed database table for production performance

CREATE TABLE IF NOT EXISTS completed_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    order_created TIMESTAMPTZ,
    carrier_company_name TEXT NOT NULL,
    carrier_pay TEXT,
    quote_price TEXT,
    origin_city TEXT,
    origin_state TEXT,
    origin_zip TEXT,
    destination_city TEXT,
    destination_state TEXT,
    destination_zip TEXT,
    cargo TEXT,
    ship_via TEXT, -- Trailer type
    est_ship_date TIMESTAMPTZ,
    delivered_date TIMESTAMPTZ,
    order_status TEXT,
    assigned_to TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast carrier matching queries
CREATE INDEX idx_completed_orders_carrier ON completed_orders(carrier_company_name);
CREATE INDEX idx_completed_orders_origin_state ON completed_orders(origin_state);
CREATE INDEX idx_completed_orders_dest_state ON completed_orders(destination_state);
CREATE INDEX idx_completed_orders_delivered ON completed_orders(delivered_date DESC);
CREATE INDEX idx_completed_orders_ship_via ON completed_orders(ship_via);
CREATE INDEX idx_completed_orders_route ON completed_orders(origin_state, destination_state);

-- Composite index for common query pattern (carrier + route + recency)
CREATE INDEX idx_completed_orders_search ON completed_orders(
    carrier_company_name,
    origin_state,
    destination_state,
    delivered_date DESC
);

-- Enable RLS (service role access only for now - this is historical data)
ALTER TABLE completed_orders ENABLE ROW LEVEL SECURITY;

-- Service role full access (for API routes)
CREATE POLICY "Service role full access" ON completed_orders
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Optional: Authenticated users can read (for admin carrier finder)
CREATE POLICY "Authenticated users can read" ON completed_orders
    FOR SELECT
    TO authenticated
    USING (true);

COMMENT ON TABLE completed_orders IS 'Historical completed orders for AI carrier matching - 76,469 orders from 3 CSV exports';
COMMENT ON COLUMN completed_orders.carrier_pay IS 'Carrier payment amount (may use K notation like $40K)';
COMMENT ON COLUMN completed_orders.ship_via IS 'Trailer type used for shipment';
