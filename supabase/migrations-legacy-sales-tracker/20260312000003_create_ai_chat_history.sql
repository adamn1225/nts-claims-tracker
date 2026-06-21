-- AI Chat History Table
-- Stores all AI Sales Coach and Help conversations for persistence and analytics

CREATE TABLE IF NOT EXISTS ai_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NULL, -- NULL for general/help mode
  conversation_id UUID NOT NULL, -- Groups messages in same conversation session
  mode TEXT NOT NULL CHECK (mode IN ('sales', 'help')),
  page_path TEXT, -- URL context (e.g., /dashboard/customers/NS-8709)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tag TEXT CHECK (tag IN ('SCRIPT', 'REBUTTAL', 'TIP', 'ANSWER', 'CLARIFY')),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  web_search_used BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_ai_chat_broker ON ai_chat_history(broker_id);
CREATE INDEX idx_ai_chat_customer ON ai_chat_history(customer_id);
CREATE INDEX idx_ai_chat_conversation ON ai_chat_history(conversation_id);
CREATE INDEX idx_ai_chat_created ON ai_chat_history(created_at DESC);
CREATE INDEX idx_ai_chat_not_archived ON ai_chat_history(is_archived) WHERE is_archived = FALSE;

-- Row-Level Security
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Brokers can only see their own chat history
CREATE POLICY "Brokers can view own chat history"
  ON ai_chat_history
  FOR SELECT
  USING (auth.uid() = broker_id);

-- Brokers can insert their own messages
CREATE POLICY "Brokers can insert own chat messages"
  ON ai_chat_history
  FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

-- Brokers can update (archive) their own messages
CREATE POLICY "Brokers can archive own chat messages"
  ON ai_chat_history
  FOR UPDATE
  USING (auth.uid() = broker_id)
  WITH CHECK (auth.uid() = broker_id);

-- Comments
COMMENT ON TABLE ai_chat_history IS 'Persistent storage for AI Sales Coach and Help conversations';
COMMENT ON COLUMN ai_chat_history.conversation_id IS 'UUID grouping messages in the same conversation session';
COMMENT ON COLUMN ai_chat_history.customer_id IS 'NULL for general sales coaching or page help mode';
COMMENT ON COLUMN ai_chat_history.mode IS 'sales (coaching) or help (page assistance)';
COMMENT ON COLUMN ai_chat_history.page_path IS 'URL context for page-aware help';
COMMENT ON COLUMN ai_chat_history.is_archived IS 'Soft delete - archived instead of deleted when user clears chat';
