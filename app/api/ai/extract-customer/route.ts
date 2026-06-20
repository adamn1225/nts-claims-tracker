import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { tavily } from "@tavily/core";

/**
 * POST /api/ai/extract-customer
 * 
 * Extracts customer information from raw email text using AI (OpenAI GPT-4o-mini)
 * and optionally enriches with web data (Tavily). Returns extracted fields without creating a record.
 * 
 * Body:
 * - email_text: string (raw email content)
 * - enrich_data?: boolean (search for additional info, default: true)
 * - opportunity_type?: string (how this lead came in, optional)
 * 
 * Returns:
 * - extracted_fields: What was extracted from the email
 * - enrichment_performed: Whether web enrichment was done
 * - enrichment_notes: Additional info found via web search
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get broker record to ensure user is active
    const { data: broker, error: brokerError } = await supabase
      .from("brokers")
      .select("id, is_active")
      .eq("id", user.id)
      .single();

    if (brokerError || !broker || !broker.is_active) {
      return NextResponse.json(
        { error: "Broker not found or inactive" },
        { status: 403 }
      );
    }

    const { email_text, enrich_data = true, opportunity_type } = await request.json();

    if (!email_text || typeof email_text !== "string") {
      return NextResponse.json(
        { error: "email_text is required and must be a string" },
        { status: 400 }
      );
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Step 1: Use OpenAI to extract structured customer data from email text
    const extractionPrompt = `Extract customer/contact information from this email and return it as JSON.

Email content:
"""
${email_text}
"""

Extract ALL available information and return a JSON object with these fields (use null if not found):
{
  "business_name": string (company name),
  "first_name": string,
  "last_name": string,
  "job_title": string,
  "phone": string (primary/cell phone), 
  "phone_2": string (office/direct line),
  "phone_3": string (main/HQ number),
  "email": string,
  "first_name2": string (secondary contact first name),
  "last_name2": string (secondary contact last name),
  "job_title2": string (secondary contact title),
  "phone2": string (secondary contact phone),
  "email2": string (secondary contact email),
  "address": string,
  "address_2": string (secondary location address),   
  "city": string,
  "city_2": string (secondary location city),
  "state": string (2-letter abbreviation),
  "state_2": string (secondary location state),
  "zip": string,
  "zip_2": string (secondary location zip),
  "industry": string (best guess from: "Construction & Development", "Personal/Individual", "Industrial & Manufacturing", "Government", "Agriculture, Mining & Natural Resources", "Energy & Utilities (Oil, Gas, Renewables)", "Automotive & Fleet", "Logistics, Warehousing & 3PL (Ports/Rail/Intermodal)", "Public Sector (Government, Defense, Education)", "Technology, Aerospace & Telecom", "Other"),
  "shipping_frequency": string (estimate from: "other", "yearly", "quarterly", "monthly", "weekly", "multiple_per_week", "bi_weekly"),
  "notes": string (brief summary of the inquiry/request from email - keep it concise, under 200 chars),
  "opportunity_type": string (infer from: "new_call_in", "new_lead", "cold_call", "referral", "origin_destination_contact", "existing_customer", "other")
}

IMPORTANT: 
- For phone numbers, format as (XXX) XXX-XXXX if US/Canada
- For state, use 2-letter abbreviation (TX, CA, WI, etc.)
- Extract the MAIN contact person (usually the email sender) as primary contact
- If multiple contacts mentioned, put additional contacts in secondary contact fields
- Be thorough - extract EVERY piece of contact info mentioned
- Preserve the original email context in notes field`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a data extraction expert. Extract customer information from emails and return valid JSON. Be thorough and accurate. If a field is not found, use null.",
        },
        { role: "user", content: extractionPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const extractedData = JSON.parse(completion.choices[0].message.content || "{}");

    // Step 2: Web enrichment (if enabled and Tavily API available)
    let enrichment_notes = "";
    let enrichmentUrls: { website?: string; linkedin?: string } = {};

    if (enrich_data && extractedData.business_name && process.env.TAVILY_API_KEY) {
      try {
        const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

        // Build search query with business name and location for better accuracy
        const searchQuery = [
          extractedData.business_name,
          extractedData.city,
          extractedData.state,
        ].filter(Boolean).join(" ");

        console.log(`[Tavily] Searching for: ${searchQuery}`);

        // Perform Tavily web search
        const searchResults = await tavilyClient.search(searchQuery, {
          searchDepth: "basic",
          maxResults: 3,
          includeAnswer: true,
          includeRawContent: false,
        });

        // Extract useful information from results
        const foundWebsite = searchResults.results.find(
          (r: any) =>
            r.url.includes(
              extractedData.business_name.toLowerCase().replace(/[^a-z0-9]/g, "")
            ) ||
            r.url.includes(".com") ||
            r.url.includes(".net")
        );

        const linkedInProfile = searchResults.results.find(
          (r: any) =>
            r.url.includes("linkedin.com/company") ||
            r.url.includes("linkedin.com/in")
        );

        // Build enrichment notes
        const enrichmentParts: string[] = [];

        if (foundWebsite) {
          enrichmentUrls.website = foundWebsite.url;
          enrichmentParts.push(`🌐 Website: ${foundWebsite.url}`);
          if (foundWebsite.title) {
            enrichmentParts.push(`   ${foundWebsite.title}`);
          }
        }

        if (linkedInProfile) {
          enrichmentUrls.linkedin = linkedInProfile.url;
          enrichmentParts.push(`💼 LinkedIn: ${linkedInProfile.url}`);
        }

        if (searchResults.answer) {
          enrichmentParts.push(`📝 Company Info: ${searchResults.answer}`);
        }

        if (enrichmentParts.length > 0) {
          enrichment_notes =
            `\n\n--- Web Enrichment (Tavily) ---\n` +
            enrichmentParts.join("\n");
        } else {
          enrichment_notes = `\n\n--- Web Enrichment ---\nNo additional information found for ${extractedData.business_name}`;
        }
      } catch (e) {
        console.error("Enrichment failed:", e);
        enrichment_notes = `\n\n--- Web Enrichment ---\nEnrichment search failed (non-critical)`;
      }
    } else if (enrich_data && extractedData.business_name && !process.env.TAVILY_API_KEY) {
      enrichment_notes = `\n\n--- Web Enrichment ---\nTavily API not configured`;
    }

    // Append enrichment notes to extracted notes
    if (enrichment_notes && extractedData.notes) {
      extractedData.notes += enrichment_notes;
    } else if (enrichment_notes) {
      extractedData.notes = `Imported from email on ${new Date().toISOString().split('T')[0]}${enrichment_notes}`;
    }

    // Add URLs if found
    if (enrichmentUrls.website) {
      extractedData.website_url = enrichmentUrls.website;
    }
    if (enrichmentUrls.linkedin) {
      extractedData.linkedin_url = enrichmentUrls.linkedin;
    }

    // Override opportunity_type if explicitly provided
    if (opportunity_type) {
      extractedData.opportunity_type = opportunity_type;
    }

    return NextResponse.json({
      success: true,
      extracted_fields: extractedData,
      enrichment_performed: enrich_data && extractedData.business_name && !!process.env.TAVILY_API_KEY,
      message: "Customer data extracted successfully",
    });
  } catch (error: any) {
    console.error("Error extracting customer from email:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract customer from email" },
      { status: 500 }
    );
  }
}
