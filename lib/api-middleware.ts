/**
 * API Middleware
 * Handles authentication, rate limiting, and request logging for /api/v1/* endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashToken, isValidTokenFormat, canPerformAction } from "./api-token-utils";

// Initialize Supabase client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export interface ApiToken {
  id: string;
  team_member_id: string;
  name: string;
  scopes: string[];
  rate_limit_per_hour: number;
  requests_count: number;
  last_reset_at: string;
  is_active: boolean;
  expires_at: string | null;
}

export interface AuthenticatedRequest extends NextRequest {
  apiToken?: ApiToken;
}

/**
 * Extract API token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    return null;
  }
  
  // Support both "Bearer <token>" and just "<token>"
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

/**
 * Authenticate API request
 * Returns token details or error response
 */
export async function authenticateApiRequest(
  request: NextRequest,
): Promise<{ token: ApiToken } | { error: NextResponse }> {
  // Extract token from header
  const token = extractToken(request);
  
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing API token. Include in Authorization header." },
        { status: 401 },
      ),
    };
  }
  
  // Validate token format
  if (!isValidTokenFormat(token)) {
    return {
      error: NextResponse.json(
        { error: "Invalid token format" },
        { status: 401 },
      ),
    };
  }
  
  // Hash token for database lookup
  const tokenHash = hashToken(token);
  
  // Look up token in database
  const { data: tokenData, error: dbError } = await supabaseAdmin
    .from("api_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .single();
  
  if (dbError || !tokenData) {
    return {
      error: NextResponse.json(
        { error: "Invalid or revoked API token" },
        { status: 401 },
      ),
    };
  }
  
  // Check if token is expired
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    return {
      error: NextResponse.json(
        { error: "API token has expired" },
        { status: 401 },
      ),
    };
  }
  
  return { token: tokenData as ApiToken };
}

/**
 * Check rate limit for token
 * Returns true if within limit, false if exceeded
 */
export async function checkRateLimit(token: ApiToken): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: string;
}> {
  const now = new Date();
  const lastReset = new Date(token.last_reset_at);
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
  
  // Reset counter if more than 1 hour has passed
  if (hoursSinceReset >= 1) {
    await supabaseAdmin
      .from("api_tokens")
      .update({
        requests_count: 1,
        last_reset_at: now.toISOString(),
      })
      .eq("id", token.id);
    
    return {
      allowed: true,
      remaining: token.rate_limit_per_hour - 1,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    };
  }
  
  // Check if limit exceeded
  if (token.requests_count >= token.rate_limit_per_hour) {
    const resetAt = new Date(lastReset.getTime() + 60 * 60 * 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: resetAt.toISOString(),
    };
  }
  
  // Increment counter
  await supabaseAdmin
    .from("api_tokens")
    .update({
      requests_count: token.requests_count + 1,
    })
    .eq("id", token.id);
  
  const resetAt = new Date(lastReset.getTime() + 60 * 60 * 1000);
  return {
    allowed: true,
    remaining: token.rate_limit_per_hour - token.requests_count - 1,
    resetAt: resetAt.toISOString(),
  };
}

/**
 * Update token usage metadata
 */
export async function updateTokenUsage(
  tokenId: string,
  endpoint: string,
  ipAddress: string,
): Promise<void> {
  await supabaseAdmin
    .from("api_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      last_used_ip: ipAddress,
      last_used_endpoint: endpoint,
    })
    .eq("id", tokenId);
}

/**
 * Log API request for audit trail
 */
export async function logApiRequest(
  tokenId: string,
  request: NextRequest,
  response: { status: number; body?: any },
  startTime: number,
  error?: string,
): Promise<void> {
  const endTime = Date.now();
  const responseTimeMs = endTime - startTime;
  
  // Get IP address
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";
  
  // Parse query params
  const url = new URL(request.url);
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });
  
  // Get request body (if applicable)
  let requestBody: any = null;
  if (request.method !== "GET" && request.method !== "DELETE") {
    try {
      requestBody = await request.clone().json();
    } catch {
      // Ignore if body is not JSON
    }
  }
  
  await supabaseAdmin.from("api_request_logs").insert({
    token_id: tokenId,
    method: request.method,
    endpoint: url.pathname,
    query_params: Object.keys(queryParams).length > 0 ? queryParams : null,
    request_body: requestBody,
    response_status: response.status,
    response_time_ms: responseTimeMs,
    error_message: error || null,
    ip_address: ipAddress,
    user_agent: request.headers.get("user-agent") || null,
  });
}

/**
 * Main API middleware
 * Validates token, checks rate limit, and enforces scope permissions
 */
export async function withApiAuth(
  request: NextRequest,
  options: {
    requiredScope?: string | string[];
    table?: string;
    action?: "read" | "write" | "create" | "delete";
  } = {},
) {
  const startTime = Date.now();
  
  // Authenticate request
  const authResult = await authenticateApiRequest(request);
  
  if ("error" in authResult) {
    await logApiRequest(
      "unknown",
      request,
      { status: 401 },
      startTime,
      "Authentication failed",
    );
    return authResult.error;
  }
  
  const { token } = authResult;
  
  // Check rate limit
  const rateLimit = await checkRateLimit(token);
  
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      {
        error: "Rate limit exceeded",
        limit: token.rate_limit_per_hour,
        resetAt: rateLimit.resetAt,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": token.rate_limit_per_hour.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimit.resetAt,
        },
      },
    );
    
    await logApiRequest(
      token.id,
      request,
      { status: 429 },
      startTime,
      "Rate limit exceeded",
    );
    
    return response;
  }
  
  // Check scope permissions
  if (options.table && options.action) {
    if (!canPerformAction(token.scopes, options.table, options.action)) {
      const response = NextResponse.json(
        {
          error: "Insufficient permissions",
          required: `${options.table}:${options.action}`,
        },
        { status: 403 },
      );
      
      await logApiRequest(
        token.id,
        request,
        { status: 403 },
        startTime,
        "Insufficient permissions",
      );
      
      return response;
    }
  }
  
  // Update token usage
  await updateTokenUsage(
    token.id,
    new URL(request.url).pathname,
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown",
  );
  
  return {
    token,
    rateLimit,
    logRequest: (response: { status: number; body?: any }, error?: string) =>
      logApiRequest(token.id, request, response, startTime, error),
  };
}
