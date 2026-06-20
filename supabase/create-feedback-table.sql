-- Create feedback table for user feedback submissions
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_email TEXT,
  broker_name TEXT,
  category TEXT CHECK (category IN ('bug', 'feature_request', 'improvement', 'general', 'other')),
  page_context TEXT, -- Which page they were on when submitting feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Optional 1-5 rating
  message TEXT NOT NULL,
  user_agent TEXT, -- Browser/device info
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_reviewed BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Add RLS policies
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can submit feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = broker_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = broker_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Admins can update feedback (mark as reviewed, add notes)
CREATE POLICY "Admins can update feedback"
  ON public.feedback
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brokers
      WHERE brokers.id = auth.uid()
      AND brokers.is_admin = true
    )
  );

-- Create index for faster queries
CREATE INDEX idx_feedback_broker_id ON public.feedback(broker_id);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX idx_feedback_is_reviewed ON public.feedback(is_reviewed);
CREATE INDEX idx_feedback_category ON public.feedback(category);

-- Grant permissions
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT UPDATE ON public.feedback TO authenticated; -- Admins only via RLS
