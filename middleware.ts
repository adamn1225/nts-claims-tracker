import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";

export async function middleware(request: any) {
  // Skip middleware for cron, health check, and any public unauthed surface
  // (public claim intake form + its API, rep landing pages).
  if (
    request.nextUrl.pathname.startsWith("/api/cron/") ||
    request.nextUrl.pathname === "/api/health" ||
    request.nextUrl.pathname.startsWith("/rep/") ||
    request.nextUrl.pathname.startsWith("/api/rep/") ||
    request.nextUrl.pathname.startsWith("/intake/") ||
    request.nextUrl.pathname.startsWith("/api/intake/")
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/cron/* (cron endpoints - no auth required)
     * - api/health (health check)
     * - intake/* and api/intake/* (public claim submission form)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/cron/|api/health|api/rep/|api/intake/|rep/|intake/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
