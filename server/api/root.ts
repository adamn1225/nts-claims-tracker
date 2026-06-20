/**
 * tRPC Root Router
 * 
 * Combines all API routers
 */

import { createTRPCRouter } from "./trpc";

/**
 * Main tRPC router - add new routers here
 */
export const appRouter = createTRPCRouter({});

// Export type definition of API
export type AppRouter = typeof appRouter;
