const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('goto_connections')
    .select('broker_id,goto_user_key,goto_user_email,is_admin_token,account_key,numeric_account_key')
    .eq('is_admin_token', true)
    .limit(1)
    .single();
  
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error(error);
}

check();
