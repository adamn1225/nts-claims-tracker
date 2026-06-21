-- Carrier Availability Prediction Cache Table
-- Stores AI predictions for 24 hours to avoid redundant API calls

CREATE TABLE IF NOT EXISTS carrier_availability_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_name TEXT NOT NULL,
  route_hash TEXT NOT NULL,
  prediction JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  CONSTRAINT unique_carrier_route UNIQUE (carrier_name, route_hash)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_carrier_cache_expires 
  ON carrier_availability_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_carrier_cache_lookup 
  ON carrier_availability_cache(carrier_name, route_hash);

-- Auto-cleanup function (optional - runs on query)
CREATE OR REPLACE FUNCTION cleanup_expired_carrier_cache()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM carrier_availability_cache
  WHERE expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to cleanup expired cache periodically
CREATE OR REPLACE TRIGGER trigger_cleanup_carrier_cache
  AFTER INSERT ON carrier_availability_cache
  EXECUTE FUNCTION cleanup_expired_carrier_cache();

-- RLS (Row Level Security) - Admin only
ALTER TABLE carrier_availability_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can read/write
CREATE POLICY "Service role full access"
  ON carrier_availability_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE carrier_availability_cache IS 'Caches AI carrier availability predictions for 24 hours to reduce OpenAI API costs';
COMMENT ON COLUMN carrier_availability_cache.route_hash IS 'Cache key: ORIGIN_DEST_ORIGINCITY_DESTCITY';
COMMENT ON COLUMN carrier_availability_cache.prediction IS 'JSON: {availabilityProbability, reasoning, keyFactors, confidence, comparison}';
