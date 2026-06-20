/**
 * POST /api/ai/draft-email
 *
 * Generates a context-aware email draft using a two-pass AI pipeline:
 *   Pass 1 — Strategy: determines goal, angle, pain points, CTA
 *   Pass 2 — Draft: writes the email guided by the strategy
 *
 * Session-gated: requires an authenticated broker session (admin only enforced at UI level).
 *
 * Request body:
 *   customer_id          string   — UUID of the customer row
 *   emailType            string   — one of the EMAIL_TYPES keys
 *   tone                 string   — "professional" | "friendly" | "urgent"
 *   styleMode?           string   — "standard" | "strategic" | "creative"
 *   researchSources?        string[]  — array containing "site_scan" and/or "web_search"
 *   additionalContext?   string   — optional free-text from the broker
 *   previousDraft?       object   — { subject, body } for iterative refinement
 *   feedbackContext?     string   — broker feedback on the previous draft
 *
 * Response:
 *   { subject: string, body: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const EMAIL_TYPES: Record<string, string> = {
  introduction: "Cold Introduction",
  follow_up_after_call: "Follow-Up After a Call",
  check_in: "General Check-In",
  win_back: "Win-Back / Re-Engagement",
  quote_follow_up: "Quote Follow-Up",
  rate_check_in: "Rate / Price Check-In",
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional:
    "Use a professional, business-like tone — polished but warm. No slang.",
  friendly:
    "Use a friendly, conversational tone — like talking to someone you've built a rapport with.",
  urgent:
    "Use a direct, time-sensitive tone — convey that action is needed soon without being pushy.",
};

const STYLE_MODE: Record<string, string> = {
  standard: "Write the safest strong draft. Clear, direct, effective.",
  strategic:
    "Write with a sharper business angle and stronger value positioning. Speak to ROI and reliability.",
  creative:
    "Use a more distinctive hook, more personality, and less boilerplate. Be memorable while staying professional.",
};

/**
 * Fetch a URL and strip HTML to return readable plain text.
 * Returns null on any failure so callers can handle gracefully.
 */
async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NTS-Copilot/1.0; +https://nationwidetransport.com)",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Use gpt-4o-mini-search-preview to do a quick web research summary of a company.
 * Falls back to null on any error — model may not be available in all regions.
 */
async function openaiWebSearch(
  openai: OpenAI,
  companyName: string,
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await (openai.chat.completions.create as any)({
      model: "gpt-4o-mini-search-preview",
      max_tokens: 350,
      messages: [
        {
          role: "user",
          content: `In 3-4 sentences, what does the company "${companyName}" do? Focus on their industry, what they ship or move, types of equipment or freight they handle, and any details relevant to freight/logistics. If you cannot find specific info, say so briefly.`,
        },
      ],
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI email drafting is not configured (missing API key)." },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    customer_id,
    emailType,
    tone,
    additionalContext,
    styleMode = "standard",
    researchMode = "off",
    researchSources,
    excludeFields = [] as string[],
    previousDraft,
    feedbackContext,
  } = body;

  if (!customer_id || !emailType || !tone) {
    return NextResponse.json(
      { error: "Missing required fields: customer_id, emailType, tone" },
      { status: 400 },
    );
  }

  if (!EMAIL_TYPES[emailType]) {
    return NextResponse.json({ error: "Invalid emailType" }, { status: 400 });
  }

  try {
    const [{ data: broker }, { data: customer, error: customerError }] =
      await Promise.all([
        supabaseAdmin
          .from("brokers")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single(),
        supabaseAdmin
          .from("customers")
          .select(
            "business_name, first_name, last_name, contact_name, job_title, industry, city, state, shipping_frequency, status, estimated_value, last_contact_date, next_follow_up_date, notes, website_url, linkedin_url, opportunity_type",
          )
          .eq("id", customer_id)
          .single(),
      ]);

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const [{ data: contactLog }, { data: tasks }] = await Promise.all([
      supabaseAdmin
        .from("contact_log")
        .select("type, subject, notes, contact_date")
        .eq("customer_id", customer_id)
        .order("contact_date", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("tasks")
        .select("title, status, due_date, notes")
        .eq("customer_id", customer_id)
        .order("due_date", { ascending: false })
        .limit(5),
    ]);

    const contactName =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.contact_name ||
      "the contact";

    const brokerName = broker
      ? `${broker.first_name} ${broker.last_name || ""}`.trim()
      : "your freight broker";

    // Build customer context block
    const contextLines: string[] = [
      `Company: ${customer.business_name}`,
      `Contact: ${contactName}${customer.job_title ? ` (${customer.job_title})` : ""}`,
      `Industry: ${customer.industry || "Unknown"}`,
      `Location: ${[customer.city, customer.state].filter(Boolean).join(", ") || "Unknown"}`,
      `Status: ${customer.status || "prospect"}`,
      `Shipping Frequency: ${customer.shipping_frequency || "unknown"}`,
    ];

    if (customer.opportunity_type) {
      contextLines.push(`Opportunity Type: ${customer.opportunity_type}`);
    }
    if (customer.estimated_value && !excludeFields.includes("estimated_value")) {
      contextLines.push(
        `Estimated Annual Value: $${customer.estimated_value.toLocaleString()}`,
      );
    }
    if (customer.last_contact_date && !excludeFields.includes("last_contact_date")) {
      contextLines.push(
        `Last Contact Date: ${new Date(customer.last_contact_date).toLocaleDateString()}`,
      );
    }
    if (customer.website_url) {
      contextLines.push(`Website: ${customer.website_url}`);
    }
    if (customer.linkedin_url) {
      contextLines.push(`LinkedIn: ${customer.linkedin_url}`);
    }
    if (customer.notes?.trim() && !excludeFields.includes("broker_notes")) {
      contextLines.push(
        `\nBroker Notes:\n${customer.notes.trim().slice(0, 500)}`,
      );
    }

    if (contactLog && contactLog.length > 0 && !excludeFields.includes("contact_log")) {
      contextLines.push("\nRecent Activity (newest first):");
      contactLog.forEach((entry) => {
        const date = new Date(entry.contact_date).toLocaleDateString();
        const note = entry.notes
          ? ` — "${entry.notes.slice(0, 120)}${entry.notes.length > 120 ? "…" : ""}"`
          : "";
        contextLines.push(`  [${date}] ${entry.type}: ${entry.subject}${note}`);
      });
    }

    if (tasks && tasks.length > 0 && !excludeFields.includes("tasks")) {
      contextLines.push("\nOpen/Recent Tasks:");
      tasks.forEach((task) => {
        const due = task.due_date
          ? new Date(task.due_date).toLocaleDateString()
          : "no due date";
        contextLines.push(`  [${task.status}] ${task.title} (due ${due})`);
      });
    }

    if (additionalContext?.trim()) {
      contextLines.push(
        `\nBroker's additional context: ${additionalContext.trim()}`,
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Resolve research flags — researchSources (new multi-select) takes priority over legacy researchMode
    const doSiteScan = Array.isArray(researchSources)
      ? researchSources.includes("site_scan")
      : researchMode === "website_only" || researchMode === "web_light";
    const doWebSearch = Array.isArray(researchSources)
      ? researchSources.includes("web_search")
      : researchMode === "web_light";

    // Research phase
    let researchContext = "";
    if (doSiteScan || doWebSearch) {
      const researchParts: string[] = [];

      if (doSiteScan && customer.website_url) {
        const scraped = await scrapeWebsite(customer.website_url);
        if (scraped) {
          researchParts.push(`[Company Website Content]\n${scraped}`);
        }
      }

      if (doWebSearch) {
        const searched = await openaiWebSearch(openai, customer.business_name!);
        if (searched) {
          researchParts.push(`[Web Research]\n${searched}`);
        }
      }

      if (researchParts.length > 0) {
        researchContext =
          "\n\nExternal Research (use as additional context, do not quote directly):\n" +
          researchParts.join("\n\n");
      }
    }

    const systemPrompt = `You are a high-performing freight broker at NTS / Heavy Haulers — one of the nation's leading heavy equipment and oversize load transport companies.

Your job is not to summarize CRM notes. Your job is to write an email that gives the broker a usable advantage:
- Open with a relevant angle
- Sound human
- Make a point
- Move the conversation forward

Write like an experienced broker who understands operations, timing, freight pressure, and relationship-building.

Hard rules:
- Do NOT simply restate the provided context in sentence form.
- Do NOT turn CRM fields into a summary email.
- Do NOT use generic filler like "I hope you're doing well" or "just touching base."
- Use only 1-2 customer-specific details from the context, and only if they strengthen the message.
- Pick one main angle for the email and commit to it.
- Keep it concise: 2-4 short paragraphs.
- Sound natural, commercially sharp, and specific.
- You may infer likely business needs from industry, location, shipping frequency, status, and recent activity, but do not invent fake facts, quotes, loads, or promises.
- End with a clear next step.
- Sign off as ${brokerName}.

Return only valid JSON in this exact format:
{"subject":"...","body":"..."}
The body must be plain text with \\n between paragraphs. No HTML. No markdown.`;

    // Iterative refinement path — revise an existing draft based on broker feedback
    if (previousDraft?.subject && previousDraft?.body && feedbackContext?.trim()) {
      const revisionCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.85,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here is the current draft:\n\nSubject: ${previousDraft.subject}\n\nBody:\n${previousDraft.body}\n\n---\nFeedback: ${feedbackContext.trim()}\n\nRevise the email based on this feedback. Keep what's working, improve what isn't. Return only JSON with "subject" and "body".`,
          },
        ],
      });
      const raw = revisionCompletion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      if (!parsed.subject || !parsed.body) {
        throw new Error("AI response missing subject or body");
      }
      return NextResponse.json({ subject: parsed.subject, body: parsed.body });
    }

    // Pass 1 — Strategy analysis
    const strategyCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a senior freight sales strategist. Analyze the customer context and determine the optimal email strategy. Return JSON with exactly these keys:
- "goal": string — what this email should accomplish
- "angle": string — the strongest hook or entry point for this specific customer
- "pain_points": string[] — likely pain points for this customer (1-3 items)
- "details_to_reference": string[] — the 1-2 most useful customer-specific details to mention (not all of them)
- "cta": string — the clearest call to action to close with`,
        },
        {
          role: "user",
          content: `Email type: ${EMAIL_TYPES[emailType]}\n\nCustomer context:\n${contextLines.join("\n")}${researchContext}\n\nDetermine the sharpest strategy for this email.`,
        },
      ],
    });

    let strategy: Record<string, unknown> = {};
    try {
      strategy = JSON.parse(
        strategyCompletion.choices[0]?.message?.content ?? "{}",
      );
    } catch {
      // Strategy unavailable — draft pass will still produce a good result
    }

    const strategyBlock =
      Object.keys(strategy).length > 0
        ? `\nEmail strategy (follow this):\n- Goal: ${strategy.goal}\n- Angle: ${strategy.angle}\n- Pain points to address: ${(strategy.pain_points as string[] | undefined)?.join(", ")}\n- Details to reference: ${(strategy.details_to_reference as string[] | undefined)?.join(", ")}\n- CTA: ${strategy.cta}`
        : "";

    // Pass 2 — Draft
    const userPrompt = `Write a ${EMAIL_TYPES[emailType]} email.

Tone:
${TONE_INSTRUCTIONS[tone]}

Style directive:
${STYLE_MODE[styleMode] ?? STYLE_MODE.standard}

Objective:
Create a draft that feels commercially intelligent, not like a rewritten CRM note.
${strategyBlock}

Customer context:
${contextLines.join("\n")}${researchContext}

Instructions:
- Use the context as background, not as an outline.
- Focus on what would matter most to this customer right now.
- Mention only the details that actually improve relevance.
- Lead with a useful angle, not a recap.
- Make the draft feel like it came from a broker who understands their business.
- Keep the subject line specific and non-generic.

Return only valid JSON with "subject" and "body".`;

    const draftCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = draftCompletion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    if (!parsed.subject || !parsed.body) {
      throw new Error("AI response missing subject or body");
    }

    return NextResponse.json({ subject: parsed.subject, body: parsed.body });
  } catch (err: unknown) {
    console.error("AI draft-email error:", err);
    return NextResponse.json(
      { error: "Failed to generate email draft. Please try again." },
      { status: 500 },
    );
  }
}
