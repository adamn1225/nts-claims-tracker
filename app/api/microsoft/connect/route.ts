/**
 * Initiate Microsoft OAuth flow
 * 
 * This endpoint redirects the user to Microsoft's authorization page
 * to grant access to Calendar and Teams.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { REQUIRED_SCOPES } from '@/lib/microsoft-graph';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // TODO: Once Azure credentials are available, implement OAuth flow
    // For now, return a placeholder response
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/microsoft/callback`;
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Microsoft integration not configured yet. Azure credentials needed.' },
        { status: 501 }
      );
    }
    
    // Build Microsoft authorization URL
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', REQUIRED_SCOPES);
    authUrl.searchParams.set('state', user.id); // Use user ID as state for verification
    authUrl.searchParams.set('response_mode', 'query');
    
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Microsoft OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Microsoft connection' },
      { status: 500 }
    );
  }
}
