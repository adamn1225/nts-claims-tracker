/**
 * useMediaQuery Hook
 * 
 * Detects screen size and returns boolean based on media query.
 * Handles SSR safely by returning false during server-side rendering.
 * 
 * USAGE:
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * 
 * BREAKPOINTS:
 * - Mobile: (max-width: 767px)
 * - Tablet: (min-width: 768px) and (max-width: 1023px)
 * - Desktop: (min-width: 1024px)
 */

"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } 
    // Fallback for older browsers
    else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  // Return false during SSR to avoid hydration mismatch
  if (!mounted) {
    return false;
  }

  return matches;
}

// Predefined breakpoint hooks for convenience
export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet() {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}

export function useIsMobileOrTablet() {
  return useMediaQuery("(max-width: 1023px)");
}
