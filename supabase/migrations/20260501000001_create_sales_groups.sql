-- ==========================================
-- SALES GROUPS TABLE
-- ==========================================
-- Lets sales coaches organize brokers into named groups (e.g. PIP cohort,
-- new-hire class, high-potential watch list) and filter the monitor dashboard
-- and exports to only show that group.

CREATE TABLE IF NOT EXISTS sales_groups (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  description TEXT,
  group_type  TEXT        NOT NULL DEFAULT 'general'
              CHECK (group_type IN ('pip', 'general', 'top_performers', 'new_hire', 'custom')),
  created_by  UUID        NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SALES GROUP MEMBERS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS sales_group_members (
  id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id  UUID        NOT NULL REFERENCES sales_groups(id)  ON DELETE CASCADE,
  broker_id UUID        NOT NULL REFERENCES brokers(id)       ON DELETE CASCADE,
  added_by  UUID        REFERENCES brokers(id)                ON DELETE SET NULL,
  added_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(group_id, broker_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_groups_created_by        ON sales_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_groups_active            ON sales_groups(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sales_group_members_group_id   ON sales_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_sales_group_members_broker_id  ON sales_group_members(broker_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE sales_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_group_members ENABLE ROW LEVEL SECURITY;

-- Only admins and sales coaches can view groups
CREATE POLICY "Coaches and admins can view groups"
  ON sales_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE id = auth.uid() AND (is_admin = TRUE OR is_sales_coach = TRUE)
    )
  );

CREATE POLICY "Coaches and admins can create groups"
  ON sales_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE id = auth.uid() AND (is_admin = TRUE OR is_sales_coach = TRUE)
    )
  );

CREATE POLICY "Creator or admin can update groups"
  ON sales_groups FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM brokers WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Creator or admin can delete groups"
  ON sales_groups FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM brokers WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Group members
CREATE POLICY "Coaches and admins can view group members"
  ON sales_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers
      WHERE id = auth.uid() AND (is_admin = TRUE OR is_sales_coach = TRUE)
    )
  );

CREATE POLICY "Group creator or admin can add members"
  ON sales_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_groups
      WHERE id = sales_group_members.group_id
        AND (
          created_by = auth.uid() OR
          EXISTS (SELECT 1 FROM brokers WHERE id = auth.uid() AND is_admin = TRUE)
        )
    )
  );

CREATE POLICY "Group creator or admin can remove members"
  ON sales_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sales_groups
      WHERE id = sales_group_members.group_id
        AND (
          created_by = auth.uid() OR
          EXISTS (SELECT 1 FROM brokers WHERE id = auth.uid() AND is_admin = TRUE)
        )
    )
  );
