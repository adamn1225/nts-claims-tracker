-- Create broker_permissions table for granular permission control
-- This allows admins to customize what each broker can do beyond simple role flags

CREATE TABLE IF NOT EXISTS public.broker_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  
  -- View permissions
  can_view_all_brokers BOOLEAN DEFAULT FALSE,
  can_view_office_brokers BOOLEAN DEFAULT TRUE,
  can_view_all_customers BOOLEAN DEFAULT FALSE,
  can_view_office_customers BOOLEAN DEFAULT FALSE,
  
  -- Edit permissions
  can_edit_own_customers BOOLEAN DEFAULT TRUE,
  can_edit_office_customers BOOLEAN DEFAULT FALSE,
  can_edit_all_customers BOOLEAN DEFAULT FALSE,
  
  -- Task permissions
  can_view_all_tasks BOOLEAN DEFAULT FALSE,
  can_view_office_tasks BOOLEAN DEFAULT FALSE,
  can_edit_own_tasks BOOLEAN DEFAULT TRUE,
  can_edit_office_tasks BOOLEAN DEFAULT FALSE,
  can_edit_all_tasks BOOLEAN DEFAULT FALSE,
  
  -- Management permissions
  can_manage_users BOOLEAN DEFAULT FALSE,
  can_manage_statuses BOOLEAN DEFAULT FALSE,
  can_manage_permissions BOOLEAN DEFAULT FALSE,
  can_export_data BOOLEAN DEFAULT FALSE,
  can_view_analytics BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(broker_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_broker_permissions_broker_id ON public.broker_permissions(broker_id);

-- Enable RLS
ALTER TABLE public.broker_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Brokers can view their own permissions
CREATE POLICY "Brokers can view own permissions"
ON public.broker_permissions
FOR SELECT
USING (broker_id = auth.uid());

-- Admins and managers can view all permissions
CREATE POLICY "Admins can view all permissions"
ON public.broker_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.brokers
    WHERE brokers.id = auth.uid()
    AND (brokers.is_admin = TRUE OR brokers.is_manager = TRUE)
  )
);

-- Only admins can update permissions
CREATE POLICY "Admins can update permissions"
ON public.broker_permissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.brokers
    WHERE brokers.id = auth.uid()
    AND brokers.is_admin = TRUE
  )
);

-- Only admins can insert permissions
CREATE POLICY "Admins can insert permissions"
ON public.broker_permissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.brokers
    WHERE brokers.id = auth.uid()
    AND brokers.is_admin = TRUE
  )
);

-- Function to auto-create permissions for new brokers
CREATE OR REPLACE FUNCTION public.create_default_permissions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.broker_permissions (
    broker_id,
    can_view_office_brokers,
    can_edit_own_customers,
    can_edit_own_tasks
  ) VALUES (
    NEW.id,
    TRUE,
    TRUE,
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create permissions on broker creation
DROP TRIGGER IF EXISTS create_broker_permissions_trigger ON public.brokers;
CREATE TRIGGER create_broker_permissions_trigger
AFTER INSERT ON public.brokers
FOR EACH ROW
EXECUTE FUNCTION public.create_default_permissions();

-- Function to set manager permissions
CREATE OR REPLACE FUNCTION public.set_manager_permissions(manager_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.broker_permissions
  SET
    can_view_all_brokers = TRUE,
    can_view_office_brokers = TRUE,
    can_view_office_customers = TRUE,
    can_view_office_tasks = TRUE,
    can_edit_office_customers = TRUE,
    can_edit_office_tasks = TRUE,
    can_view_analytics = TRUE,
    updated_at = NOW()
  WHERE broker_id = manager_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set admin permissions
CREATE OR REPLACE FUNCTION public.set_admin_permissions(admin_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.broker_permissions
  SET
    can_view_all_brokers = TRUE,
    can_view_office_brokers = TRUE,
    can_view_all_customers = TRUE,
    can_view_office_customers = TRUE,
    can_edit_all_customers = TRUE,
    can_view_all_tasks = TRUE,
    can_view_office_tasks = TRUE,
    can_edit_all_tasks = TRUE,
    can_manage_users = TRUE,
    can_manage_statuses = TRUE,
    can_manage_permissions = TRUE,
    can_export_data = TRUE,
    can_view_analytics = TRUE,
    updated_at = NOW()
  WHERE broker_id = admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill permissions for existing brokers
INSERT INTO public.broker_permissions (broker_id)
SELECT id FROM public.brokers
WHERE id NOT IN (SELECT broker_id FROM public.broker_permissions)
ON CONFLICT (broker_id) DO NOTHING;

-- Set admin permissions for existing admins
UPDATE public.broker_permissions bp
SET
  can_view_all_brokers = TRUE,
  can_view_all_customers = TRUE,
  can_edit_all_customers = TRUE,
  can_view_all_tasks = TRUE,
  can_edit_all_tasks = TRUE,
  can_manage_users = TRUE,
  can_manage_statuses = TRUE,
  can_manage_permissions = TRUE,
  can_export_data = TRUE,
  can_view_analytics = TRUE
FROM public.brokers b
WHERE bp.broker_id = b.id
AND b.is_admin = TRUE;

-- Set manager permissions for existing managers
UPDATE public.broker_permissions bp
SET
  can_view_all_brokers = TRUE,
  can_view_office_customers = TRUE,
  can_view_office_tasks = TRUE,
  can_edit_office_customers = TRUE,
  can_edit_office_tasks = TRUE,
  can_view_analytics = TRUE
FROM public.brokers b
WHERE bp.broker_id = b.id
AND b.is_manager = TRUE
AND b.is_admin = FALSE;

COMMENT ON TABLE public.broker_permissions IS 'Granular permissions for each broker, allowing admins to customize access levels beyond simple role flags';
COMMENT ON COLUMN public.broker_permissions.can_view_all_brokers IS 'Can see and switch to any broker in the system (admin/manager only)';
COMMENT ON COLUMN public.broker_permissions.can_view_office_brokers IS 'Can see and switch to brokers in the same office_location';
COMMENT ON COLUMN public.broker_permissions.can_manage_users IS 'Can invite, edit, and manage other brokers';
