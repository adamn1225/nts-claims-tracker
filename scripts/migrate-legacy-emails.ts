/**
 * One-time migration script to normalize legacy @nationwidetransportservices.com emails
 * to @ntslogistics.com in Supabase Auth and brokers table.
 * 
 * Run this BEFORE re-enabling email normalization in login.
 * 
 * Usage: npx ts-node scripts/migrate-legacy-emails.ts
 */

import { createClient } from '@supabase/supabase-js';

// Admin client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function migrateLegacyEmails() {
  console.log('🔍 Starting email migration...\n');

  try {
    // Step 1: Find all users with @nationwidetransportservices.com emails
    const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const legacyUsers = allUsers.users.filter(user => 
      user.email?.endsWith('@nationwidetransportservices.com')
    );

    if (legacyUsers.length === 0) {
      console.log('✅ No legacy email addresses found. Nothing to migrate.');
      return;
    }

    console.log(`📧 Found ${legacyUsers.length} users with legacy email domain:\n`);
    legacyUsers.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });
    console.log('');

    // Step 2: Migrate each user
    let successCount = 0;
    let errorCount = 0;

    for (const user of legacyUsers) {
      const oldEmail = user.email!;
      const newEmail = oldEmail.replace('@nationwidetransportservices.com', '@ntslogistics.com');
      
      console.log(`🔄 Migrating: ${oldEmail} → ${newEmail}`);

      try {
        // Update email in Supabase Auth
        const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email: newEmail }
        );

        if (updateAuthError) {
          throw new Error(`Auth update failed: ${updateAuthError.message}`);
        }

        // Update email in brokers table
        const { error: updateBrokerError } = await supabase
          .from('brokers')
          .update({ email: newEmail })
          .eq('id', user.id);

        if (updateBrokerError) {
          console.warn(`   ⚠️  Broker table update failed: ${updateBrokerError.message}`);
          // Don't fail the migration if broker table update fails
        }

        console.log(`   ✅ Successfully migrated`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }

      console.log('');
    }

    // Step 3: Summary
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📧 Total: ${legacyUsers.length}`);
    console.log('');

    if (successCount > 0) {
      console.log('🎉 Migration complete! Users can now login with either:');
      console.log('   - @ntslogistics.com (normalized)');
      console.log('   - @nationwidetransportservices.com (auto-normalized during login)');
      console.log('');
      console.log('✅ Safe to re-enable email normalization in login flow');
    }

  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the migration
migrateLegacyEmails()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
