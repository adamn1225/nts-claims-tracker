/**
 * Microsoft OAuth callback handler
 * 
 * Receives the authorization code from Microsoft and exchanges it for tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // team_member_id
    const error = searchParams.get('error');
    
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=microsoft_auth_failed`
      );
    }
    
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=invalid_callback`
      );
    }
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Verify state matches current user
    if (!user || user.id !== state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=invalid_state`
      );
    }
    
    // TODO: Once Azure credentials are available, exchange code for tokens
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/microsoft/callback`;
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=not_configured`
      );
    }
    
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=token_exchange_failed`
      );
    }
    
    const tokens = await tokenResponse.json();
    
    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);
    
    // Store tokens in database
    const { error: dbError } = await supabase
      .from('microsoft_tokens')
      .upsert({
        team_member_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      });
    
    if (dbError) {
      console.error('Error storing tokens:', dbError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=storage_failed`
      );
    }
    
    // Enable Microsoft integration in preferences
    await supabase
      .from('user_preferences')
      .update({ microsoft_integration_enabled: true })
      .eq('user_id', user.id);
    
    // Success! Redirect back to settings
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?success=microsoft_connected`
    );
  } catch (error) {
    console.error('Error in Microsoft OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=callback_failed`
    );
  }
}
