/**
 * tRPC Client Utilities
 * 
 * Sets up tRPC React Query hooks for use in components
 */

import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/api/root";

/**
 * tRPC React hooks
 */
export const api = createTRPCReact<AppRouter>();

/**
 * Get base URL for tRPC API
 */
function getBaseUrl() {
    if (typeof window !== "undefined") {
        // Browser: use relative URL
        return "";
    }

    if (process.env.VERCEL_URL) {
        // Vercel deployment
        return `https://${process.env.VERCEL_URL}`;
    }

    if (process.env.NETLIFY_URL) {
        // Netlify deployment
        return `https://${process.env.NETLIFY_URL}`;
    }

    // Development fallback
    return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * tRPC client configuration
 */
export function getTRPCConfig() {
    return {
        links: [
            httpBatchLink({
                url: `${getBaseUrl()}/api/trpc`,
            }),
        ],
    };
}
