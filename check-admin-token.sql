SELECT 
  user_id,
  goto_user_key,
  goto_user_email,
  is_admin_token,
  account_key,
  numeric_account_key,
  created_at,
  updated_at,
  expires_at
FROM goto_connections
WHERE is_admin_token = true;
