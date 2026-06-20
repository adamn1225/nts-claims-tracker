-- =====================================================
-- File Uploads for Feedback and Customer Attachments
-- Created: February 5, 2026
-- =====================================================

-- 1. Update feedback table to support attachments
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachment_size INTEGER;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- 2. Create customer_attachments table
CREATE TABLE IF NOT EXISTS customer_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES brokers(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Enable RLS on customer_attachments
ALTER TABLE customer_attachments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for customer_attachments table

-- Brokers can view attachments for their assigned customers
CREATE POLICY "Brokers can view their customer attachments"
ON customer_attachments FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR customer_id IN (
    SELECT id FROM customers WHERE broker_id = auth.uid()
  )
);

-- Brokers can upload attachments for their customers
CREATE POLICY "Brokers can upload customer attachments"
ON customer_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND customer_id IN (
    SELECT id FROM customers WHERE broker_id = auth.uid()
  )
);

-- Brokers can delete their own attachments
CREATE POLICY "Brokers can delete their attachments"
ON customer_attachments FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- 4. Storage Buckets (created manually in Supabase Dashboard)
-- Bucket: feedback-attachments (private)
-- Bucket: customer-documents (private)

-- 5. Storage RLS Policies for feedback-attachments

-- Allow authenticated users to upload feedback attachments
CREATE POLICY "Allow authenticated users to upload feedback attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'feedback-attachments');

-- Allow authenticated users to read feedback attachments
CREATE POLICY "Allow users to read feedback attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'feedback-attachments');

-- 6. Storage RLS Policies for customer-documents

-- Brokers can upload customer documents
CREATE POLICY "Brokers can upload customer documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-documents' 
  AND auth.uid() IN (SELECT id FROM brokers)
);

-- Brokers can view customer documents
CREATE POLICY "Brokers can view customer documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IN (SELECT id FROM brokers)
);

-- Brokers can delete customer documents
CREATE POLICY "Brokers can delete customer documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IN (SELECT id FROM brokers)
);

-- 7. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_attachments_customer_id 
ON customer_attachments(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_attachments_uploaded_by 
ON customer_attachments(uploaded_by);

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Storage buckets must be created manually in Supabase Dashboard
-- 2. Recommended file size limits:
--    - Feedback: 5MB max
--    - Customer documents: 10MB max
-- 3. Allowed MIME types:
--    - Images: image/*
--    - Documents: application/pdf, .doc, .docx, .xls, .xlsx
-- 4. File naming convention:
--    - feedback-attachments/{user_id}/{timestamp}_{filename}
--    - customer-documents/{customer_id}/{timestamp}_{filename}
-- =====================================================
