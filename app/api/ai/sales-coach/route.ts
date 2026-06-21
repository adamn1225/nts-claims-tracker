/**
 * POST /api/ai/sales-coach
 *
 * AI Sales Coach for the dialer - provides real-time coaching during calls.
 * Generates scripts, handles objections, answers questions about the prospect.
 *
 * Request body:
 *   customerId  string      — UUID of the current customer
 *   message     string      — TeamMember's question/request
 *   history     Message[]   — Previous conversation (last 10 messages)
 *   callState   string      — Current call state ('ringing' | 'answered' | 'ended' | 'idle')
 *
 * Response:
 *   {
 *     reply: string,
 *     tag: 'SCRIPT' | 'REBUTTAL' | 'TIP' | 'ANSWER' | 'CLARIFY',
 *     confidence: 'high' | 'medium' | 'low',
 *     latency: number,
 *     tokensUsed: number
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import OpenAI from "openai";
import { tavily } from "@tavily/core";
import { brand } from "@/config/app.config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

//─── Generic AI coaching prompt helpers ───────────────────────────────

const CORE_SYSTEM_PROMPT = `You are an AI Sales Coach embedded in ${brand.name}, a sales CRM. You help sales reps before and during calls: draft talk tracks, handle objections, suggest discovery questions, and answer questions about the prospect.

Always start your reply with a tag in square brackets — [SCRIPT], [REBUTTAL], [TIP], [ANSWER], or [CLARIFY] — then your response. Keep it tight and actionable. If you don't know something, say so plainly rather than inventing details.`;

interface CustomerRecord {
  business_name?: string | null;
  contact_name?: string | null;
  title?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  shipping_frequency?: string | null;
  opportunity_type?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

interface ContactLogEntry {
  type?: string | null;
  notes?: string | null;
  outcome?: string | null;
  contact_date?: string | null;
  subject?: string | null;
}

function buildCustomerContext(
  customer: CustomerRecord,
  contactLog: ContactLogEntry[],
  callState: string,
): string {
  const lines: string[] = ["CURRENT CONTACT"];
  lines.push(`- Company: ${customer.business_name || "Unknown"}`);
  lines.push(
    `- Contact: ${customer.contact_name || "Unknown"}${
      customer.title ? `, ${customer.title}` : ""
    }`,
  );
  if (customer.industry) lines.push(`- Industry: ${customer.industry}`);
  const location = [customer.city, customer.state].filter(Boolean).join(", ");
  if (location) lines.push(`- Location: ${location}`);
  if (customer.status) lines.push(`- Status: ${customer.status}`);
  if (customer.shipping_frequency)
    lines.push(`- Contact frequency: ${customer.shipping_frequency}`);
  if (customer.opportunity_type)
    lines.push(`- Opportunity type: ${customer.opportunity_type}`);
  if (customer.notes) lines.push(`- Notes: ${customer.notes}`);
  lines.push(`- Call state: ${callState}`);

  if (contactLog?.length) {
    lines.push("\nRECENT ACTIVITY:");
    for (const c of contactLog) {
      lines.push(
        `- [${c.contact_date}] ${c.type ?? "note"}${
          c.subject ? `: ${c.subject}` : ""
        }${c.outcome ? ` (${c.outcome})` : ""}${c.notes ? ` — ${c.notes}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

//─── Page Help Context Builder ───────────────────────────────────────────────

function getPageHelpContext(pathname: string) {
  if (pathname.includes("/power-dialer")) {
    return {
      pageName: "Power Dialer",
      description: "The Power Dialer helps team members efficiently call through their customer queue with auto-progression and quick outcome logging.",
      features: [
        "Queue modes: All Customers, Overdue Only, Custom Filters",
        "Auto-advance to next customer after logging outcome",
        "Quick outcome buttons: Connected, Voicemail, No Answer, Wrong Number",
        "Integrated task scheduling (1 day, 3 days, 1 week, etc.)",
        "Call notes and history logging",
        "Real-time AI Sales Coach integration",
      ],
    };
  }

  if (pathname.includes("/imports")) {
    return {
      pageName: "Import & Export",
      description: "Import customer lists via CSV and distribute leads to team members across your team.",
      features: [
        "CSV upload with drag-and-drop support",
        "Preview data before importing",
        "Distribute contacts to individual team members or use even distribution",
        "Filter by industry, state, or source before distributing",
        "Track distributed contacts with assigned team member info",
        "Bulk actions: reassign, delete, update source tags",
        "Limbo tab shows assigned contacts not yet in workspace",
      ],
    };
  }

  if (pathname.includes("/kanban")) {
    return {
      pageName: "Kanban Board",
      description: "Visual pipeline board showing customers organized by status columns (Prospect, Exploring, In Play, Won, Lost, etc.).",
      features: [
        "Drag-and-drop cards between columns to update status",
        "Pin important customers to keep them at the top",
        "Filter by status, source, or search by name/company",
        "Click card to view full customer details and history",
        "Custom status columns (customizable by managers/admins)",
        "Source-based filtering to group similar leads",
      ],
    };
  }

  if (pathname.includes("/tasks")) {
    return {
      pageName: "Tasks Page",
      description: "Manage all your follow-ups, calls, and to-dos with priority levels and due dates.",
      features: [
        "Task views: Active, Today, Upcoming, Overdue, Completed",
        "Priority levels: Urgent, High, Normal, Low",
        "Email and in-app notifications for due/overdue tasks",
        "Quick task templates for common actions",
        "Linked to customers for context",
        "Task completion modal with outcome logging",
      ],
    };
  }

  if (pathname.includes("/calendar")) {
    return {
      pageName: "Calendar View",
      description: "Visualize all scheduled follow-ups and tasks in a calendar format.",
      features: [
        "Month, week, and day views",
        "Click any date to add a new task",
        "Click a task to view details or mark complete",
        "Color-coded by priority or task type",
        "Integrates with task notification system",
      ],
    };
  }

  if (pathname.includes("/customers/")) {
    return {
      pageName: "Customer Profile",
      description: "Detailed view of a single customer with full contact information, history, and follow-up tracking.",
      features: [
        "Quick Actions: Call (click-to-dial), Schedule follow-up, Share contact with team",
        "Contact Information: Name, title, phone, email, address, industry, opportunity type",
        "Contact Log: Full history of calls, emails, meetings, notes with timestamps",
        "Attachments: Upload/download documents (quotes, contracts, shipping details)",
        "Status Management: Track customer status (Prospecting, Active, Won, Lost, etc.)",
        "Follow-Up Tracking: Last contact date, next follow-up date, overdue alerts",
        "Contact Frequency: Multiple per week, weekly, bi-weekly, monthly, quarterly, yearly",
        "Social Links: Website, LinkedIn, Facebook, Twitter, Instagram integration",
        "Edit Customer: Update any field, add notes, change assigned owner (admin)",
        "AI Email Templates: Generate custom emails based on customer context",
        "Pin/Unpin: Keep important customers visible in your pinned list",
        "Share Contact: Distribute customer to other team members for collaboration",
      ],
      prospectingTips: [
        "Industry Research: Look up the customer's industry to understand their typical needs and buying triggers",
        "Company Size Indicators: Check employee count on LinkedIn, website 'About Us' pages, or business directories to gauge deal potential",
        "Seasonal Patterns: Many industries have seasonal peaks — align your outreach with their busy and budgeting seasons",
        "Geographic Reach: Multi-location companies often have broader, recurring needs",
        "Pain Points to Explore: Frustration with their current vendor, unexpected costs, poor communication, slow response times",
        "Qualifying Questions: What's your current solution? What's working/not working? Who else is involved in the decision? What's your timeline?",
        "Value Propositions: Reliability, a dedicated point of contact, transparency, flexibility, competitive pricing",
        "Follow-Up Strategy: Prospect status = weekly touches, Active = bi-weekly check-ins, Won = monthly relationship building",
      ],
    };
  }

  // Default dashboard help
  return {
    pageName: "Dashboard",
    description: "Main overview showing KPIs, recent activity, and quick actions for managing your book of business.",
    features: [
      "Key metrics: Total customers, active deals, tasks due today",
      "Recent activity feed showing latest calls, emails, meetings",
      "Pinned customers for quick access",
      "Weekly activity chart",
      "Quick actions: Add Customer, Create Task, View Calendar",
    ],
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ResponseTag = "SCRIPT" | "REBUTTAL" | "TIP" | "ANSWER" | "CLARIFY";

interface CoachResponse {
  reply: string;
  tag: ResponseTag;
  confidence?: "high" | "medium" | "low";
  webSearchUsed?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─── Helper: Parse AI response ───────────────────────────────────────────────

function parseCoachResponse(rawReply: string): CoachResponse {
  const tagMatch = rawReply.match(/^\[(\w+)\]/);
  const tag = (tagMatch?.[1] as ResponseTag) || "ANSWER";
  const reply = rawReply.replace(/^\[\w+\]\s*/, "").trim();

  // Detect uncertainty phrases
  const lowConfidencePhrases = [
    "not sure",
    "don't have that",
    "recommend checking",
    "ask dispatch",
    "verify with",
  ];
  const confidence = lowConfidencePhrases.some((p) =>
    reply.toLowerCase().includes(p)
  )
    ? "low"
    : "high";

  return { reply, tag, confidence };
}

// ─── Helper: Web Search for Customer Research ────────────────────────────────

async function searchWeb(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) {
    return "Web search unavailable (no API key configured)";
  }

  try {
    const response = await tavilyClient.search(query, {
      searchDepth: "basic", // "basic" or "advanced" (advanced costs 2x credits)
      maxResults: 5,
      includeAnswer: true, // Get AI-generated summary
      includeRawContent: false, // Don't need full HTML
    });

    // Format results for AI context
    const results = response.results
      .map((r: any, i: number) => 
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`
      )
      .join("\n\n");

    const answer = response.answer 
      ? `Summary: ${response.answer}\n\n` 
      : "";

    return `${answer}Search Results:\n${results}`;
  } catch (error) {
    console.error("Tavily search error:", error);
    return "Web search failed. Try manual research on LinkedIn or Google.";
  }
}

// ─── Admin Assistant Context ─────────────────────────────────────────────────

/**
 * Returns a short description of the admin/app area the user is currently on,
 * so the Admin Assistant is genuinely context-aware on every page.
 */
function getAdminPageContext(pathname: string): string {
  const map: { match: string; label: string; detail: string }[] = [
    {
      match: "/dashboard/admin/updates",
      label: "App Updates (admin)",
      detail:
        "Create/edit/publish announcements that appear in the dashboard 'App Updates' widget. Supports title, slug, excerpt, markdown content, category, and published/draft status.",
    },
    {
      match: "/dashboard/admin",
      label: "Admin Console",
      detail:
        "Tabbed admin area: TeamMembers (add/deactivate/roles), Reassign (move customers between team members), API Tokens, Features (feature access control), Landing Pages (review team member landing configs), Email (broadcasts, templates, daily digest), Company (analytics), Maintenance (toggle maintenance mode, schedule a window, AI-assisted message, email all users).",
    },
    {
      match: "/dashboard/performance",
      label: "Performance / Coaching",
      detail:
        "Company-wide call quality coaching. Analyzes call recordings with AI to detect missing qualifying questions and coachable moments.",
    },
    {
      match: "/dashboard/power-dialer",
      label: "Dialer",
      detail: "Queue-based calling with auto-advance, outcome logging, and task scheduling.",
    },
    {
      match: "/dashboard/kanban",
      label: "Kanban Board",
      detail: "Pipeline board of customers by status; drag-and-drop, pin, filter.",
    },
    {
      match: "/dashboard/imports",
      label: "Import & Export",
      detail: "CSV import and lead distribution to team members.",
    },
    {
      match: "/dashboard/tasks",
      label: "Tasks",
      detail: "Follow-ups and to-dos with priorities, due dates, and notifications.",
    },
    {
      match: "/dashboard/calendar",
      label: "Calendar",
      detail: "Calendar view of scheduled tasks and follow-ups.",
    },
    {
      match: "/dashboard/settings",
      label: "Settings",
      detail: "Per-user notification preferences, timezone, and digest time.",
    },
    {
      match: "/dashboard/customers/",
      label: "Customer Profile",
      detail: "Single customer detail with contact info, history, and follow-ups.",
    },
    {
      match: "/dashboard",
      label: "Dashboard Home",
      detail: "KPI overview, recent activity, pinned customers, weekly tasks, and the App Updates widget.",
    },
  ];

  const hit = map.find((m) => pathname.includes(m.match));
  if (!hit) {
    return `Current page: ${pathname} (general app area).`;
  }
  return `Current page: "${hit.label}" (${pathname}).\n${hit.detail}`;
}

/**
 * Builds the system prompt for the admin-only Admin Assistant. It is aware of
 * the whole app's admin surface and the page the admin is currently viewing.
 */
function buildAdminSystemPrompt(pathname: string): string {
  const pageContext = getAdminPageContext(pathname);

  return `You are the AI Admin Assistant for ${brand.name}, an internal sales CRM (Next.js + Supabase + Tailwind). You help ADMINS operate and configure the app.

${pageContext}

What you know about the app's admin capabilities:
- Admin Console (/dashboard/admin) tabs:
  - Users: add users, deactivate, set roles/permissions (is_admin, is_manager, is_sales_coach, is_active).
  - Reassign: move customers between users.
  - API Tokens: manage integration tokens.
  - Features: feature access control.
  - Landing Pages: review and approve user landing-page configs.
  - Email: send email broadcasts, manage templates, send the daily digest.
  - Company: company + user activity analytics.
  - Maintenance: turn maintenance mode on/off, schedule a window (start + expected-back), write the user message (with AI "Write/Improve"), and email all active users a warning. Non-admins see a maintenance page with a countdown; admins keep access.
  - App Updates (/dashboard/admin/updates): create announcements shown in the dashboard "App Updates" widget.
- Notifications: per-user timezone + digest time; reminders/digests sent via SendGrid, scheduled by pg_cron hitting /api/cron/* endpoints.
- Hyperfocus principle: only notify users about actions they did NOT initiate; avoid self-notifications.

Your role:
- Give clear, accurate, step-by-step guidance for admin tasks, grounded in the capabilities above.
- Be aware of the current page and tailor answers to it; if a task lives on another page, tell the admin exactly where to go.
- Keep responses concise and practical (a few sentences or a short numbered list).
- If you are unsure whether a specific control exists, say so rather than inventing it. Do not fabricate menu items, settings, or API routes.
- You are advising, not executing: you cannot click buttons or change settings yourself.`;
}

// ─── Main API Route ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let customerId: string | null;
  let message: string;
  let history: Message[] = [];
  let callState: string = "unknown";
  let mode: "sales" | "help" | "admin" = "sales";
  let currentPage: string = "/dashboard";

  try {
    const body = await request.json();
    console.log("📨 AI Coach request body:", body);
    customerId = body.customerId || null;
    message = body.message;
    history = body.history || [];
    callState = body.callState || "unknown";
    mode = body.mode || "sales";
    currentPage = body.currentPage || "/dashboard";
  } catch (error) {
    console.error("❌ Failed to parse request body:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message) {
    console.error("❌ Missing required field: message");
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 }
    );
  }

  // Admin Assistant mode is restricted to admins.
  if (mode === "admin") {
    const { data: adminTeamMember } = await supabase
      .from("team_members")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!adminTeamMember?.is_admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }
  }

  // Build system prompt based on mode
  let fullSystemPrompt: string;

  if (mode === "admin") {
    // ADMIN ASSISTANT MODE — context-aware on every page, admin-focused.
    fullSystemPrompt = buildAdminSystemPrompt(currentPage);
  } else if (mode === "help") {
    // PAGE HELP MODE - Context-aware help for the current page
    const pageContext = getPageHelpContext(currentPage);
    
    // Build features list
    const featuresText = pageContext.features.map((f: string) => `- ${f}`).join("\n");
    
    // Add prospecting tips for customer profile pages
    const prospectingSection = (pageContext as any).prospectingTips 
      ? `\n\nProspecting & Research Strategies:
${(pageContext as any).prospectingTips.map((tip: string) => `- ${tip}`).join("\n")}

When asked about researching a customer or prospecting strategies:
- Suggest checking LinkedIn for company size, recent posts, and decision-makers
- Recommend visiting their website's "About Us", "Locations", and "Careers" pages
- Advise Google searches like "[company name] news" or "[company name] [their industry]"
- Mention industry-specific challenges based on their sector
- Provide conversation starters and qualifying questions
- Offer follow-up cadence recommendations based on their status`
      : "";

    fullSystemPrompt = `You are a helpful AI assistant for ${brand.name}, a sales CRM application.

The user is currently on the "${pageContext.pageName}" page.

${pageContext.description}

Key Features on this Page:
${featuresText}${prospectingSection}

Your role:
- Answer questions about THIS PAGE ONLY
- Explain features, buttons, and workflows specific to this page
- Provide step-by-step guidance for common tasks
- For customer profile pages: Help with prospecting research and strategy
- Keep responses concise (2-3 sentences max for simple questions)
- Be friendly and helpful, like a patient co-worker showing the ropes

If asked about features NOT on this page, briefly mention where to find them and stay focused on the current page context.`;
  } else {
    // SALES COACHING MODE - Original functionality
    
    // If customer ID provided, fetch customer-specific context
    if (customerId) {
      // Fetch customer data
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      // Security: Verify teamMember owns this customer (or is admin)
      if (customer.team_member_id !== user.id) {
        const { data: profile } = await supabase
          .from("team_members")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role !== "admin" && profile?.role !== "manager") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // Fetch recent contact history
      const { data: contactLog } = await supabase
        .from("contact_log")
        .select("type, notes, outcome, contact_date, subject")
        .eq("customer_id", customerId)
        .order("contact_date", { ascending: false })
        .limit(5);

      // Build complete system prompt with layers (customer-specific)
      fullSystemPrompt = [
        CORE_SYSTEM_PROMPT,
        buildCustomerContext(customer, contactLog || [], callState),
      ].join("\n\n---\n\n");
    } else {
      // General sales coaching without a specific customer
      const pageContext = getPageHelpContext(currentPage);
      
      fullSystemPrompt = `${CORE_SYSTEM_PROMPT}

CURRENT PAGE CONTEXT:
You are helping a sales rep who is currently on the "${pageContext.pageName}" page (${currentPage}).

${pageContext.description}

You are providing general sales coaching advice. The rep hasn't selected a specific customer yet, so provide guidance on:
- Cold calling techniques and scripts
- Handling common objections
- Qualifying leads and discovery questions  
- Building rapport and trust
- Closing techniques
- Follow-up strategies (email vs phone, timing, cadence)
- Industry-specific prospecting tips
- Best practices for B2B sales

IMPORTANT: You ARE aware of what page the user is on. If asked "can you see my page" or "what page am I on", confirm that you can see they're on the ${pageContext.pageName} page and offer relevant help.

Keep responses practical and actionable.`;
    }
  }

  // ─── Web Search Integration ─────────────────────────────────────────────────
  // Tavily searches the web and returns factual data (articles, company info, news)
  // ─── Web Search Integration ─────────────────────────────────────────────────
  // Tavily searches the web and returns factual data (articles, company info, news)
  // OpenAI then processes these results to answer the user's question
  
  let webSearchResults = "";
  let searchWasTriggered = false;

  // SMART AUTO-SEARCH: Always search when customer is loaded in sales mode
  // This ensures teamMembers always have complete context for their calls
  
  // Fetch customer data first to check for missing fields
  let customerData: any = null;
  let missingCriticalFields = false;
  
  if (customerId && mode === "sales") {
    const { data } = await supabase
      .from("customers")
      .select("business_name, contact_name, industry, website_url, linkedin_url, shipping_frequency, opportunity_type, title, city, state, notes")
      .eq("id", customerId)
      .single();
    
    customerData = data;
    
    // Check if critical logistics fields are missing
    if (customerData) {
      const criticalFieldsMissing = [
        !customerData.industry || customerData.industry.trim() === "",
        !customerData.shipping_frequency,
        !customerData.opportunity_type || customerData.opportunity_type.trim() === "",
      ].filter(Boolean).length;
      
      missingCriticalFields = criticalFieldsMissing >= 1; // Missing ANY critical field = auto-search
    }
  }

  // AUTO-TRIGGER web search when customer is loaded in sales mode
  // This provides complete context for coaching
  const shouldAutoSearch = customerId && mode === "sales" && customerData?.business_name && missingCriticalFields;

  if (shouldAutoSearch && customerData?.business_name) {
    console.log(`🔍 AUTO-SEARCH TRIGGERED: Customer ${customerData.business_name} missing ${missingCriticalFields ? 'critical fields' : 'data'}`);
    searchWasTriggered = true;
    
    // Analyze which logistics-critical fields are missing
    const missingFields: string[] = [];
    const searchFocus: string[] = [];
      
      if (!customerData.industry || customerData.industry.trim() === "") {
        missingFields.push("industry");
        searchFocus.push("industry sector");
      }
      if (!customerData.shipping_frequency) {
        missingFields.push("shipping_frequency");
        searchFocus.push("shipping frequency and patterns");
      }
      if (!customerData.opportunity_type || customerData.opportunity_type.trim() === "") {
        missingFields.push("opportunity_type");
        searchFocus.push("products or services they need");
      }
      if (!customerData.website_url || customerData.website_url.trim() === "") {
        missingFields.push("website_url");
        searchFocus.push("company website");
      }
      if (!customerData.linkedin_url || customerData.linkedin_url.trim() === "") {
        missingFields.push("linkedin_url");
        searchFocus.push("LinkedIn profile or decision makers");
      }
      if (!customerData.title || customerData.title.trim() === "") {
        missingFields.push("contact_title");
        searchFocus.push("key decision maker titles");
      }
      
      // Build comprehensive search query with missing field hints
      let searchQuery = `${customerData.business_name} ${customerData.city || ""} ${customerData.state || ""} company business`.trim();
      
      // Add search terms based on missing fields
      if (searchFocus.includes("industry sector")) {
        searchQuery += " industry sector";
      }
      if (searchFocus.includes("shipping frequency and patterns")) {
        searchQuery += " size customers needs";
      }
      
      console.log(`🎯 Enhanced search query: "${searchQuery}"`);
      console.log(`📋 Missing fields to research: ${missingFields.join(", ") || "none"}`);
      
      webSearchResults = await searchWeb(searchQuery);
      
      // Build missing fields guidance for AI
      const missingFieldsGuidance = missingFields.length > 0 
        ? `\n\n🔍 DATA GAPS TO FILL (Missing from CRM):
${missingFields.map(field => {
  switch(field) {
    case "industry": return "- INDUSTRY: Try to identify their industry sector from search results (Technology, Manufacturing, Retail, Healthcare, Finance, etc.)";
    case "shipping_frequency": return "- CONTACT FREQUENCY: Look for clues about how often they'd need your product/service (daily, weekly, monthly, seasonal patterns)";
    case "opportunity_type": return "- OPPORTUNITY TYPE: What products or services would they need from you?";
    case "website_url": return "- WEBSITE: Find their company website URL";
    case "linkedin_url": return "- LINKEDIN: Find their LinkedIn company page";
    case "contact_title": return "- DECISION MAKER: Identify decision-maker names and titles";
    default: return `- ${field.toUpperCase()}: Research this field`;
  }
}).join("\n")}

IMPORTANT: When presenting findings, suggest SPECIFIC information to add to these missing fields based on what you found.
Example: "Based on their industry focus, I'd suggest:
- Industry: [sector]
- Contact Frequency: [cadence that fits their business]
- Opportunity Type: [products/services they'd buy]"
`
        : "";
      
      // Add search results to system prompt
      fullSystemPrompt += `\n\n═══════════════════════════════════════════════════════════════════════════════
🔍 LIVE WEB RESEARCH RESULTS (from Tavily - current as of ${new Date().toLocaleDateString()})
═══════════════════════════════════════════════════════════════════════════════

${webSearchResults}
${missingFieldsGuidance}

CRITICAL INSTRUCTIONS FOR PRESENTING WEB SEARCH RESULTS:

✅ THE SEARCH HAS ALREADY BEEN COMPLETED - Results are above
✅ Present findings as FACTS you discovered, not promises to search later
✅ Format your response like this:

"I found some recent information about ${customerData.business_name}:

1. [Specific finding from search results with date/source]
2. [Another specific finding]
3. [Third finding if relevant]

Based on this, here are some conversation starters for your call:
- [Specific question about finding #1]
- [Follow-up about finding #2]

${missingFields.length > 0 ? `
📝 SUGGESTED CRM UPDATES:
After this call, consider adding:
- [Field name]: [Value based on research]
- [Another field]: [Another value]
` : ""}

For more details, you can check their [website/LinkedIn/news source mentioned in results]."

❌ NEVER say: "I'll do a search..." (it's already done!)
❌ NEVER say: "Would you like me to search?" (you already did!)
❌ NEVER say: "Would you like to proceed with that?" (proceed with what??)
❌ NEVER end with vague questions - give SPECIFIC actionable advice
❌ If results are generic/unhelpful: "I searched but only found basic company info. Let me suggest some research angles..."

Remember: You're presenting COMPLETED research, not offering to do it.
═══════════════════════════════════════════════════════════════════════════════`;
  }

  // ─── Message Preprocessing (Inject Customer Name) ─────────────────────────────
  // Replace generic phrases with actual customer name to guarantee context
  let processedMessage = message;
  
  if (customerId) {
    const { data: customerData } = await supabase
      .from("customers")
      .select("business_name, contact_name")
      .eq("id", customerId)
      .single();
    
    if (customerData) {
      const customerName = customerData.contact_name || customerData.business_name || "this customer";
      const businessName = customerData.business_name || "this company";
      
      // Replace generic phrases with actual names
      processedMessage = message
        .replace(/\b(the )?contact name\b/gi, customerName)
        .replace(/\b(the )?customer\b(?! profile| page)/gi, customerName)
        .replace(/\bthis (company|business)\b/gi, businessName)
        .replace(/\b(who is |who are )(this|they)\b/gi, `$1${customerName}`);
      
      if (processedMessage !== message) {
        console.log(`📝 Message preprocessed: "${message}" → "${processedMessage}"`);
      }
    }
  }

  // ─── Debug Logging ──────────────────────────────────────────────────────────────
  console.log("\n🔍 DEBUG INFO:");
  console.log("  Customer ID:", customerId || "(none)");
  console.log("  Mode:", mode);
  console.log("  Original message:", message);
  console.log("  Processed message:", processedMessage);
  console.log("  System prompt length:", fullSystemPrompt.length, "chars");
  console.log("  System prompt preview (first 800 chars):");
  console.log(fullSystemPrompt.substring(0, 800));
  console.log("  Web search triggered:", searchWasTriggered);
  console.log("\n");

  // Build messages array for OpenAI
  const messages: any[] = [
    { role: "system", content: fullSystemPrompt },
    ...history.slice(-10), // Last 10 messages for context
    { role: "user", content: processedMessage }, // Use preprocessed message
  ];

  // Call OpenAI
  try {
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 400,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.3,
    });

    const latency = Date.now() - startTime;
    const rawReply = response.choices[0]?.message?.content?.trim() ?? "";

    const parsed = parseCoachResponse(rawReply);

    // Log for monitoring
    console.log(
      `[AI Sales Coach] ${latency}ms | Tag: ${parsed.tag} | Confidence: ${parsed.confidence}`
    );

    return NextResponse.json({
      ...parsed,
      latency,
      tokensUsed: response.usage?.total_tokens || 0,
      webSearchUsed: searchWasTriggered,
    });
  } catch (err) {
    console.error("AI sales coach error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate coach response",
        fallback:
          "Try rephrasing your question, or check the contact's details and notes for context.",
      },
      { status: 500 }
    );
  }
}
