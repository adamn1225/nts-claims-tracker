/**
 * Disconnect Microsoft account
 * 
 * Removes stored OAuth tokens and disables integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { disconnectMicrosoftAccount } from '@/lib/microsoft-graph';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Delete tokens
    const result = await disconnectMicrosoftAccount(user.id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to disconnect Microsoft account' },
        { status: 500 }
      );
    }
    
    // Disable integration in preferences
    await supabase
      .from('user_preferences')
      .update({ microsoft_integration_enabled: false })
      .eq('user_id', user.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Microsoft account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Microsoft account' },
      { status: 500 }
    );
  }
}
