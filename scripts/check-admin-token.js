#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Checking for admin GoTo token...\n');

const { data, error } = await supabase
  .from('goto_connections')
  .select('user_id, goto_user_key, goto_user_email, is_admin_token, account_key, numeric_account_key, created_at, expires_at')
  .eq('is_admin_token', true);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('❌ No admin token found in database');
  console.log('\n📝 You need to authenticate with GoTo as admin:');
  console.log('   Visit: http://localhost:3000/api/goto/auth?admin=true');
} else {
  console.log('✅ Admin token found!');
  console.log('\nDetails:');
  data.forEach(row => {
    console.log('  User ID:', row.user_id);
    console.log('  Email:', row.goto_user_email);
    console.log('  GoTo User Key:', row.goto_user_key);
    console.log('  Account Key:', row.account_key);
    console.log('  Numeric Account Key:', row.numeric_account_key);
    console.log('  Created:', new Date(row.created_at).toLocaleString());
    console.log('  Expires:', row.expires_at ? new Date(row.expires_at).toLocaleString() : 'N/A');
  });
}

console.log('');
