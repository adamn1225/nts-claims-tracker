import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Supabase Middleware
 * Refreshes auth tokens and redirects unauthenticated users
 * Enforces 1-hour inactivity timeout (persists across browser sessions)
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Handle invalid/expired refresh tokens gracefully
  let user = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (error: any) {
    // If refresh token is invalid, clear auth cookies silently
    if (error?.code === 'refresh_token_not_found' || error?.status === 400) {
      console.log('Clearing invalid auth session');
      await supabase.auth.signOut();
    } else {
      console.error('Auth error:', error);
    }
  }

  // Check broker account status and profile completeness
  if (user) {
    const { data: broker } = await supabase
      .from("brokers")
      .select("is_active, first_name, last_name, office_location")
      .eq("id", user.id)
      .single();

    // If account is deactivated, sign them out immediately
    if (broker && broker.is_active === false) {
      console.log(`Deactivated account attempted login: ${user.email}`);
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("reason", "deactivated");
      const response = NextResponse.redirect(url);
      response.cookies.delete("last_activity");
      return response;
    }

    // If broker profile is incomplete OR missing entirely, force them to complete it
    // before accessing dashboard. A missing broker row (broker === null) means the
    // user authenticated (e.g. via SSO) but their brokers record was never created;
    // they must go through complete-profile to create it themselves.
    const profileIncomplete =
      !broker ||
      !broker.first_name ||
      !broker.last_name ||
      !broker.office_location;

    const onCompleteProfilePage = request.nextUrl.pathname.startsWith("/auth/complete-profile");
    const onDashboard = request.nextUrl.pathname.startsWith("/dashboard");

    if (profileIncomplete && onDashboard && !onCompleteProfilePage) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/complete-profile";
      return NextResponse.redirect(url);
    }

    // If profile is now complete and they're on the complete-profile page, send to dashboard
    if (!profileIncomplete && onCompleteProfilePage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Check inactivity timeout for authenticated users
  if (user) {
    const lastActivity = request.cookies.get("last_activity")?.value;
    const now = Date.now();
    // Treat last_sign_in_at as the baseline — any last_activity cookie older than
    // the current sign-in is from a previous session and must not trigger a sign-out.
    const lastSignInMs = user.last_sign_in_at
      ? new Date(user.last_sign_in_at).getTime()
      : 0;

    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity);

      if (lastActivityTime < lastSignInMs) {
        // Stale cookie from a previous session (e.g. SSO just completed, or
        // user logged back in after expiry). Reset it instead of signing out.
        supabaseResponse.cookies.set("last_activity", now.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
      } else {
        const inactiveDuration = now - lastActivityTime;

        // If inactive for more than 1 hour, log out
        if (inactiveDuration > INACTIVITY_TIMEOUT) {
          await supabase.auth.signOut();
          const url = request.nextUrl.clone();
          url.pathname = "/auth/login";
          url.searchParams.set("reason", "inactivity");
          const response = NextResponse.redirect(url);
          response.cookies.delete("last_activity");
          return response;
        }
      }
    }

    // Update last activity timestamp for any authenticated request
    supabaseResponse.cookies.set("last_activity", now.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
  }

  // Protect dashboard routes - redirect to login if not authenticated
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  // EXCEPT pages that need to run their own auth flow
  const authFlowPages = ["/auth/update-password", "/auth/sso", "/auth/callback", "/auth/complete-profile"];
  if (user && request.nextUrl.pathname.startsWith("/auth") &&
    !authFlowPages.some(p => request.nextUrl.pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse;
}
