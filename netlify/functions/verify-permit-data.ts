import { createClient } from "@supabase/supabase-js";

/**
 * Netlify Scheduled Function - Monthly Permit Data Verification
 * 
 * Runs on the 1st of each month at 2:00 AM UTC
 * Uses Tavily API to verify state permit data accuracy
 * 
 * Schedule syntax: https://docs.netlify.com/functions/scheduled-functions/
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Priority states to verify first (most complex regulations)
const PRIORITY_STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'MI', 'WA', 'OR'];

interface TavilySearchResult {
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}

interface VerificationResult {
  state: string;
  success: boolean;
  confidence: number;
  sources: string[];
  suggestedCost?: string;
  suggestedTime?: string;
  suggestedNotes?: string;
  needsManualReview: boolean;
  error?: string;
}

/**
 * Search Tavily API for state permit information
 */
async function searchStateDOT(state: string): Promise<TavilySearchResult | null> {
  const query = `
    ${state} Department of Transportation oversized overweight load permit costs 
    processing time requirements ${new Date().getFullYear()}
  `.trim();

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        include_domains: [
          `${state.toLowerCase()}.gov`,
          `dot.${state.toLowerCase()}.gov`,
          `transportation.${state.toLowerCase()}.gov`,
        ],
        max_results: 3,
        include_answer: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error searching for ${state}:`, error);
    return null;
  }
}

/**
 * Analyze Tavily results and extract permit data
 */
function analyzeResults(state: string, results: TavilySearchResult): VerificationResult {
  const { results: searchResults } = results;
  
  if (!searchResults || searchResults.length === 0) {
    return {
      state,
      success: false,
      confidence: 0,
      sources: [],
      needsManualReview: true,
      error: "No search results found",
    };
  }

  // Extract sources
  const sources = searchResults.map(r => r.url);
  
  // Calculate confidence based on:
  // - Number of official .gov results
  // - Content relevance scores
  const govResults = searchResults.filter(r => r.url.includes('.gov'));
  const avgScore = searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length;
  
  let confidence = 0;
  confidence += govResults.length * 30; // 30 points per .gov result
  confidence += avgScore * 40; // Up to 40 points for relevance
  
  // Cap at 100
  confidence = Math.min(confidence, 100);
  
  // Low confidence = needs manual review
  const needsManualReview = confidence < 70;
  
  // For now, we don't auto-extract cost/time (would need GPT parsing)
  // This function flags states for manual review
  
  return {
    state,
    success: true,
    confidence: Math.round(confidence),
    sources,
    needsManualReview,
  };
}

/**
 * Save verification results to database
 */
async function saveVerificationResults(results: VerificationResult[]) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Log verification run (you could create a table for this)
  const logEntries = results.map(r => ({
    state: r.state,
    confidence_score: r.confidence,
    needs_review: r.needsManualReview,
    sources: r.sources,
    verified_at: new Date().toISOString(),
  }));
  
  console.log("Verification Results:", logEntries);
  
  // TODO: Store in permit_verification_log table (create if needed)
  // For now, just log to console
  
  return logEntries;
}

/**
 * Main handler
 */
const handler = async (event: any, context: any) => {
  console.log("🔍 Starting monthly permit data verification...");
  
  // Skip if no Tavily API key
  if (!TAVILY_API_KEY) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "TAVILY_API_KEY not configured",
      }),
    };
  }
  
  const results: VerificationResult[] = [];
  
  // Verify priority states
  for (const state of PRIORITY_STATES) {
    console.log(`Verifying ${state}...`);
    
    const searchResults = await searchStateDOT(state);
    
    if (searchResults) {
      const verification = analyzeResults(state, searchResults);
      results.push(verification);
    } else {
      results.push({
        state,
        success: false,
        confidence: 0,
        sources: [],
        needsManualReview: true,
        error: "Search failed",
      });
    }
    
    // Rate limiting: wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Save results
  await saveVerificationResults(results);
  
  // Summary
  const needsReview = results.filter(r => r.needsManualReview);
  const highConfidence = results.filter(r => r.confidence >= 70);
  
  console.log(`✅ Verification complete:`);
  console.log(`  - ${results.length} states checked`);
  console.log(`  - ${highConfidence.length} high confidence`);
  console.log(`  - ${needsReview.length} need manual review`);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      checked: results.length,
      highConfidence: highConfidence.length,
      needsReview: needsReview.length,
      results,
    }),
  };
};

// Run on the 1st of every month at 2:00 AM UTC
// Cron syntax: minute hour day-of-month month day-of-week
export const config = {
  schedule: "0 2 1 * *",
};

export { handler };
