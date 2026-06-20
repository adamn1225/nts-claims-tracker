/**
 * Microsoft Clarity Analytics Component
 * 
 * PURPOSE: Initialize Microsoft Clarity tracking for full-app analytics
 * PLACEMENT: Should be included in root layout to track all pages (auth, dashboard, etc.)
 * 
 * TRACKING SCOPE:
 * - Session recordings (user interactions, clicks, scrolls)
 * - Heatmaps (where users click and scroll)
 * - Rage clicks (frustrated users clicking repeatedly)
 * - Dead clicks (clicks that don't do anything)
 * - Excessive scrolling (confused users searching for content)
 * 
 * PRIVACY: Clarity automatically masks sensitive input fields (passwords, credit cards)
 * See: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-privacy
 */

"use client";

import { useEffect } from "react";
import Clarity from "@microsoft/clarity";

export default function ClarityScript() {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

    if (!projectId) {
      console.warn("⚠️ Microsoft Clarity: No project ID found. Set NEXT_PUBLIC_CLARITY_PROJECT_ID in .env");
      return;
    }

    // Initialize Clarity only once when component mounts
    try {
      Clarity.init(projectId);
      console.log("✅ Microsoft Clarity initialized with project:", projectId);
    } catch (error) {
      console.error("❌ Failed to initialize Microsoft Clarity:", error);
    }
  }, []); // Empty dependency array = run once on mount

  // This component renders nothing - it just initializes Clarity
  return null;
}
