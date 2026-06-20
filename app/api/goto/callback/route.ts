import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { encrypt } from "@/lib/encryption";
import { extractAccountKeyFromToken } from "@/lib/goto-utils";

// GET /api/goto/callback
// Handles the OAuth redirect from GoTo — exchanges auth code for tokens
export async function GET(request: NextRequest) {
  // Build app URL from current request host (localhost vs production)
  const host = request.nextUrl.host;
  const protocol = host.includes("localhost") ? "http" : "https";
  const APP_URL = `${protocol}://${host}`;
  const appUrl = (path: string) => `${APP_URL}${path}`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // broker ID passed via state param
  const error = searchParams.get("error");

  // Create a response object early to capture session cookies
  let response = NextResponse.next({
    request,
  });

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  if (error) {
    console.error("GoTo OAuth error:", error, searchParams.get("error_description"));
    const errorRedirect = NextResponse.redirect(
      appUrl("/dashboard/settings?goto_error=access_denied")
    );
    response.cookies.getAll().forEach((cookie) => {
      errorRedirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return errorRedirect;
  }

  if (!code || !state) {
    const errorRedirect = NextResponse.redirect(
      appUrl("/dashboard/settings?goto_error=missing_params")
    );
    response.cookies.getAll().forEach((cookie) => {
      errorRedirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return errorRedirect;
  }

  const clientId = process.env.GOTO_CLIENT_ID;
  const clientSecret = process.env.GOTO_CLIENT_SECRET;

  // Build redirect URI using same host variables (already declared at top)
  const redirectUri = `${protocol}://${host}/api/goto/callback`;

  if (!clientId || !clientSecret) {
    const redirectResponse = NextResponse.redirect(
      appUrl("/dashboard/settings?goto_error=not_configured")
    );
    // Copy session cookies to redirect response
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // Verify the authenticated user matches the state (broker ID)
  // In production, session cookies may not persist during OAuth flow,
  // so we'll use the state parameter (user ID) to save the connection
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // State format: "{userId}" for regular auth, "{userId}|admin" for admin proxy auth
  const [userId, stateFlag] = state.split("|");
  const isAdminAuth = stateFlag === "admin";

  // Optional: verify session matches if available
  if (user && user.id !== userId) {
    // Security: state mismatch (possible CSRF attack or session hijack)
    const errorRedirect = NextResponse.redirect(
      appUrl("/dashboard/settings?goto_error=state_mismatch")
    );
    response.cookies.getAll().forEach((cookie) => {
      errorRedirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return errorRedirect;
  }

  // Exchange auth code for tokens
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  let tokenData: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    principal?: string;
    account_key?: string;
  };

  try {
    const tokenResponse = await fetch(
      "https://authentication.logmeininc.com/oauth/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("GoTo token exchange failed:", tokenResponse.status, errText);
      const errorRedirect = NextResponse.redirect(
        appUrl("/dashboard/settings?goto_error=token_exchange_failed")
      );
      response.cookies.getAll().forEach((cookie) => {
        errorRedirect.cookies.set(cookie.name, cookie.value, cookie);
      });
      return errorRedirect;
    }

    tokenData = await tokenResponse.json();
    console.log("[GoTo OAuth] Token response fields:", Object.keys(tokenData));
    console.log("[GoTo OAuth] Principal field:", tokenData.principal);
  } catch (err) {
    console.error("GoTo token exchange error:", err);
    const errorRedirect = NextResponse.redirect(
      appUrl("/dashboard/settings?goto_error=network_error")
    );
    response.cookies.getAll().forEach((cookie) => {
      errorRedirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return errorRedirect;
  }

  // Fetch the account key and user email
  // GoTo sometimes returns account_key directly in the token response.
  // GoTo access tokens are also JWTs — decode to extract account_key claim.
  let accountKey: string | null = tokenData.account_key ?? null;
  let numericAccountKey: string | null = null;
  let userEmail: string | null = null;

  // Try JWT decode first (no extra network call needed)
  if (!accountKey) {
    accountKey = extractAccountKeyFromToken(tokenData.access_token);
    if (accountKey) console.log("[GoTo OAuth] account_key from JWT:", accountKey);
  }

  if (!accountKey) {
    try {
      const acctResponse = await fetch(
        "https://api.goto.com/admin/v1/accounts",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/json",
          },
        }
      );
      if (acctResponse.ok) {
        const acctData = await acctResponse.json();
        accountKey = acctData?.results?.[0]?.key ?? null;
        console.log("[GoTo OAuth] account_key from /admin/v1/accounts:", accountKey);
      } else {
        console.warn("[GoTo OAuth] /admin/v1/accounts returned", acctResponse.status);
      }
    } catch (err) {
      console.warn("Could not fetch GoTo account key:", err);
      // Non-fatal — performance route will retry on first load via JWT decode
    }
  }

  // For admin tokens: fetch numeric accountKey from legacy Admin API /me
  // This is required by call-history/v1/calls and the legacy users list endpoint.
  if (isAdminAuth) {
    try {
      const legacyMeResp = await fetch("https://api.getgo.com/admin/rest/v1/me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
        },
      });
      if (legacyMeResp.ok) {
        const legacyMe = await legacyMeResp.json();
        numericAccountKey = legacyMe?.accountKey ? String(legacyMe.accountKey) : null;
        if (!userEmail && legacyMe?.email) userEmail = legacyMe.email;
        console.log("[GoTo OAuth] numeric_account_key from legacy /me:", numericAccountKey);
      } else {
        console.warn("[GoTo OAuth] legacy /me returned", legacyMeResp.status);
      }
    } catch (err) {
      console.warn("[GoTo OAuth] Could not fetch legacy admin /me:", err);
    }
  }

  // Fetch user email from GoTo identity API
  try {
    // Try GraphQL endpoint (seen in working HAR file)
    const graphqlResponse = await fetch(
      "https://identity.goto.com/me/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: "{ me { email } }",
        }),
      }
    );

    if (graphqlResponse.ok) {
      const graphqlData = await graphqlResponse.json();
      userEmail = graphqlData?.data?.me?.email || null;
      console.log("[GoTo OAuth] Got user email from GraphQL:", userEmail);
    }

    // Fallback: Try REST endpoint
    if (!userEmail) {
      const userResponse = await fetch(
        "https://api.goto.com/users/v1/users/me",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/json",
          },
        }
      );

      if (userResponse.ok) {
        const userData = await userResponse.json();
        userEmail = userData.email || userData.emailAddress || null;
        console.log("[GoTo OAuth] Got user email from REST:", userEmail);
      } else {
        console.warn("Could not fetch GoTo user email via REST:", userResponse.status);
      }
    }

    // Fallback: Check if token response has email/principal
    if (!userEmail && tokenData.principal) {
      userEmail = tokenData.principal;
      console.log("[GoTo OAuth] Got email from token principal:", userEmail);
    }
  } catch (err) {
    console.warn("Could not fetch GoTo user email:", err);
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  // Encrypt tokens before storing
  const encryptedAccessToken = encrypt(tokenData.access_token);
  const encryptedRefreshToken = encrypt(tokenData.refresh_token);

  // Upsert into goto_connections
  // Admin auth: if another admin token already exists, update it in-place.
  // Regular auth: unique per user_id as before.
  console.log("[GoTo OAuth] Saving connection to database:", {
    userId,
    isAdminAuth,
    hasAccountKey: !!accountKey,
    hasNumericAccountKey: !!numericAccountKey,
    hasUserEmail: !!userEmail,
  });

  // Build upsert payload.
  // IMPORTANT: Only include `is_admin_token` when doing an admin auth flow.
  // Regular Settings-page connects must NOT overwrite an existing admin token
  // with is_admin_token=false — that would silently destroy the org-wide admin
  // connection every time a user reconnects GoTo from their personal settings.
  const upsertPayload: Record<string, unknown> = {
    user_id: userId,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    expires_at: expiresAt,
    account_key: accountKey,
    numeric_account_key: numericAccountKey,
    goto_user_email: userEmail,
    updated_at: new Date().toISOString(),
  };
  if (isAdminAuth) {
    upsertPayload.is_admin_token = true;
  }
  // For regular (non-admin) connects, is_admin_token is intentionally omitted so:
  //   - New rows get the column default (false)
  //   - Existing rows keep whatever value is already stored (preserves admin token flag)

  const { error: upsertError } = await supabase
    .from("goto_connections")
    .upsert(upsertPayload, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[GoTo OAuth] ❌ Failed to save GoTo connection:", upsertError);
    const errorRedirect = NextResponse.redirect(
      appUrl("/dashboard/settings?goto_error=save_failed")
    );
    // Copy session cookies to preserve authentication
    response.cookies.getAll().forEach((cookie) => {
      errorRedirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return errorRedirect;
  }

  console.log("[GoTo OAuth] ✅ Successfully saved connection to database");

  // Admin auth flows originate from the Performance Dashboard — redirect back
  // there so the user can immediately verify the new token works.
  // Regular (personal) auth flows redirect to Settings as before.
  const successPath = isAdminAuth
    ? "/dashboard/performance?goto_connected=true"
    : "/dashboard/settings?goto_connected=true";

  const successRedirect = NextResponse.redirect(appUrl(successPath));
  // Copy session cookies to preserve authentication
  response.cookies.getAll().forEach((cookie) => {
    successRedirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return successRedirect;
}
