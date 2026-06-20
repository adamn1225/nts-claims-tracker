import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyPolicy() {
  console.log('Applying import SELECT policy...');
  
  // Drop existing policy if it exists
  const dropPolicy = `
    DROP POLICY IF EXISTS "Brokers can view customers they imported" ON customers;
  `;
  
  const { error: dropError } = await supabase.rpc('exec_sql', { sql: dropPolicy });
  if (dropError) {
    console.log('Drop policy note:', dropError.message);
  }
  
  // Create new policy
  const createPolicy = `
    CREATE POLICY "Brokers can view customers they imported"
    ON customers FOR SELECT
    USING (
      -- Can view customers they imported, even if broker_id is NULL
      auth.uid() = imported_by
    );
  `;
  
  const { error: createError } = await supabase.rpc('exec_sql', { sql: createPolicy });
  if (createError) {
    console.error('Error creating policy:', createError);
    process.exit(1);
  }
  
  console.log('✅ Policy created successfully!');
  
  // Verify
  const { data, error: verifyError } = await supabase.rpc('exec_sql', { 
    sql: `
      SELECT policyname, cmd, qual::text 
      FROM pg_policies 
      WHERE tablename = 'customers' AND cmd = 'SELECT'
      ORDER BY policyname;
    ` 
  });
  
  if (!verifyError && data) {
    console.log('\n📋 All SELECT policies on customers table:');
    console.log(data);
  }
  
  process.exit(0);
}

applyPolicy();
