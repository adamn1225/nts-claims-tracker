-- Create table for user-reported permit data corrections
-- This enables community-sourced data verification

CREATE TABLE IF NOT EXISTS permit_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(2) NOT NULL,
    
    -- What the user is reporting
    reported_cost VARCHAR(50),
    reported_time VARCHAR(50),
    reported_notes TEXT,
    
    -- Context about the correction
    correction_type VARCHAR(50) NOT NULL CHECK (correction_type IN ('cost', 'time', 'notes', 'all')),
    additional_context TEXT,
    
    -- Who reported it
    reported_by_broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Verification status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'applied')),
    reviewed_by_broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Helpful metadata
    broker_email VARCHAR(255),
    broker_name VARCHAR(255),
    
    CONSTRAINT valid_state CHECK (LENGTH(state) = 2)
);

-- Indexes for common queries
CREATE INDEX idx_permit_corrections_state ON permit_corrections(state);
CREATE INDEX idx_permit_corrections_status ON permit_corrections(status);
CREATE INDEX idx_permit_corrections_reported_at ON permit_corrections(reported_at DESC);
CREATE INDEX idx_permit_corrections_broker ON permit_corrections(reported_by_broker_id);

-- RLS Policies
ALTER TABLE permit_corrections ENABLE ROW LEVEL SECURITY;

-- Brokers can submit corrections
CREATE POLICY "Brokers can submit permit corrections"
    ON permit_corrections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        reported_by_broker_id IN (
            SELECT id FROM brokers WHERE id = auth.uid() AND is_active = true
        )
    );

-- Brokers can view their own corrections
CREATE POLICY "Brokers can view own corrections"
    ON permit_corrections
    FOR SELECT
    TO authenticated
    USING (
        reported_by_broker_id IN (
            SELECT id FROM brokers WHERE id = auth.uid()
        )
    );

-- Admins can view all corrections
CREATE POLICY "Admins can view all corrections"
    ON permit_corrections
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM brokers 
            WHERE id = auth.uid() 
            AND is_admin = true 
            AND is_active = true
        )
    );

-- Admins can review/update corrections
CREATE POLICY "Admins can review corrections"
    ON permit_corrections
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM brokers 
            WHERE id = auth.uid() 
            AND is_admin = true 
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM brokers 
            WHERE id = auth.uid() 
            AND is_admin = true 
            AND is_active = true
        )
    );

-- Function to auto-populate broker email/name when correction is created
CREATE OR REPLACE FUNCTION populate_broker_info_on_correction()
RETURNS TRIGGER AS $$
BEGIN
    SELECT email, first_name || ' ' || last_name
    INTO NEW.broker_email, NEW.broker_name
    FROM brokers
    WHERE id = NEW.reported_by_broker_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER populate_broker_info_before_insert
    BEFORE INSERT ON permit_corrections
    FOR EACH ROW
    EXECUTE FUNCTION populate_broker_info_on_correction();

-- Add comment for documentation
COMMENT ON TABLE permit_corrections IS 'User-reported corrections to state permit data - enables community-sourced verification';
COMMENT ON COLUMN permit_corrections.correction_type IS 'What type of correction: cost, time, notes, or all';
COMMENT ON COLUMN permit_corrections.status IS 'pending = awaiting review, verified = confirmed accurate, rejected = incorrect, applied = integrated into main data';
