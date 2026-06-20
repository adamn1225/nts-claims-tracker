-- Add completion outcome tracking columns to tasks table
-- Run this migration in your Supabase SQL editor

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS completion_outcome TEXT,
ADD COLUMN IF NOT EXISTS completion_notes TEXT,
ADD COLUMN IF NOT EXISTS follow_up_task_id UUID REFERENCES tasks(id);

-- Add comments for clarity
COMMENT ON COLUMN tasks.completion_outcome IS 'Predefined outcome: won_deal, lost_deal, rescheduled, no_answer, not_interested, completed, other';
COMMENT ON COLUMN tasks.completion_notes IS 'Freeform notes about task completion/outcome';
COMMENT ON COLUMN tasks.follow_up_task_id IS 'If rescheduled, links to the new follow-up task created';

-- Create index for follow_up_task_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_follow_up_task_id ON tasks(follow_up_task_id);

-- Log completion
SELECT 'Task completion tracking columns added successfully' AS status;
