-- Create NTS Support Agent chat history table
-- This stores conversations with the technical support AI assistant in HelpModal
-- Separate from ai_chat_history (sales coaching) to maintain distinct purposes

CREATE TABLE IF NOT EXISTS nts_support_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL, -- Groups messages in same conversation
  page_path TEXT, -- Which page they were on when asking for help
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  
  -- Metadata
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  web_search_used BOOLEAN DEFAULT false,
  topics TEXT[], -- Array of help topics (e.g., ['kanban', 'tasks', 'troubleshooting'])
  
  -- Soft delete for analytics
  is_archived BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_nts_support_broker ON nts_support_history(broker_id);
CREATE INDEX idx_nts_support_conversation ON nts_support_history(conversation_id);
CREATE INDEX idx_nts_support_created ON nts_support_history(created_at DESC);
CREATE INDEX idx_nts_support_page ON nts_support_history(page_path) WHERE page_path IS NOT NULL;
CREATE INDEX idx_nts_support_not_archived ON nts_support_history(broker_id, is_archived) WHERE is_archived = false;
CREATE INDEX idx_nts_support_topics ON nts_support_history USING GIN(topics) WHERE topics IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE nts_support_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Brokers can only access their own support conversations

-- Policy 1: Brokers can view their own support history
CREATE POLICY brokers_view_own_support
  ON nts_support_history
  FOR SELECT
  USING (broker_id = auth.uid());

-- Policy 2: Brokers can insert their own support messages
CREATE POLICY brokers_insert_own_support
  ON nts_support_history
  FOR INSERT
  WITH CHECK (broker_id = auth.uid());

-- Policy 3: Brokers can archive (soft delete) their own conversations
CREATE POLICY brokers_archive_own_support
  ON nts_support_history
  FOR UPDATE
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

-- Comments for documentation
COMMENT ON TABLE nts_support_history IS 'Stores NTS Support Agent chat history for technical support and company knowledge';
COMMENT ON COLUMN nts_support_history.broker_id IS 'User who had the conversation';
COMMENT ON COLUMN nts_support_history.conversation_id IS 'UUID grouping messages in same conversation session';
COMMENT ON COLUMN nts_support_history.page_path IS 'Page path where user requested help (for context)';
COMMENT ON COLUMN nts_support_history.role IS 'Message author: user or assistant';
COMMENT ON COLUMN nts_support_history.content IS 'Message text content';
COMMENT ON COLUMN nts_support_history.confidence IS 'AI confidence level in response accuracy';
COMMENT ON COLUMN nts_support_history.web_search_used IS 'Whether Tavily web search was used for this response';
COMMENT ON COLUMN nts_support_history.topics IS 'Help topics covered (for analytics and search)';
COMMENT ON COLUMN nts_support_history.is_archived IS 'Soft delete flag - true when user clears conversation';
COMMENT ON COLUMN nts_support_history.created_at IS 'When the message was sent';
