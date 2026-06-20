import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";

export async function middleware(request: any) {
  // Skip middleware for cron, health check, and public broker landing pages
  if (
    request.nextUrl.pathname.startsWith("/api/cron/") ||
    request.nextUrl.pathname === "/api/health" ||
    request.nextUrl.pathname.startsWith("/rep/") ||
    request.nextUrl.pathname.startsWith("/api/rep/")
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
     */
    "/((?!_next/static|_next/image|favicon.ico|api/cron/|api/health|api/rep/|rep/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
