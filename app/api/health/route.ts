import { NextResponse } from "next/server";

/**
 * Health check endpoint for monitoring
 * Returns basic status without database dependency
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "NTS Claims Tracker",
    version: "0.1.0",
  });
}
