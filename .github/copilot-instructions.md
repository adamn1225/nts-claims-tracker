# yCopilot Instructions - Project Configuration

> **⚠️ IMPORTANT: This file needs to be configured before development begins.**
> Replace the "PROJECT CONFIGURATION REQUIRED" section below with actual project details.

---

## Project Overview

**Application Name:** NTS Claims Tracker
**Purpose:** A claims management system for tracking cargo and transportation-related claims through their full lifecycle (intake, documentation, investigation, carrier review, settlement, and closure). Replaces spreadsheets, scattered email threads, and disconnected document storage with a centralized system aligned to the Claims Processing SOP (see `workspace-docs/claims-sop.txt`).
**Target Users:** Primarily the NTS claims department; brokers (read/comment access on claims tied to their customers); managers and admins (full visibility and reporting). External carrier access is under evaluation and not yet in scope.
**Origin Note:** This codebase was forked from an internal sales CRM ("NTS Sales Tracker"). Generic CRM scaffolding (customers, tasks, contact logs, GoTo call logging, brokers) is being repurposed for claims workflows. When in doubt, the claims SOP and claims terminology are the source of truth, not the sales-tracker heritage.

## Technology Stack

**Backend:** Supabase (PostgreSQL + Auth + pg_cron)
**Database:** Supabase PostgreSQL with pg_cron extension for scheduled tasks
**Authentication:** Supabase Auth (Email/Password + Microsoft SSO via OAuth)
**Deployment:** Netlify (with serverless functions)
**Additional Services:** SendGrid (email notifications), Supabase Realtime (live updates)
**Scheduling:** pg_cron in Supabase + Netlify serverless functions as backup
**Future Mobile:** React Native app planned - keep components modular and reusable

## Design System

**Colors:**

Semantic palette — every color has a single, well-defined job. Do not introduce new ad-hoc colors; use the tokens below (or the Tailwind `slate-*` neutral scale).

| Token | Hex | Role |
| --- | --- | --- |
| Primary | `#E85D04` | NTS Orange — primary CTAs, active states, brand moments |
| Primary (text-safe) | `#C2410C` | Use when orange must appear as small body text on white (AA-compliant variant) |
| Secondary | `#1A1A1A` | Headings, body text, dark surfaces |
| Accent | `#2563EB` | Steel blue — links, secondary CTAs, informational highlights (split-complement of primary) |
| Success | `#059669` | Resolved / paid / closed-with-recovery |
| Warning | `#F59E0B` | Pending parties, missing documents, approaching deadlines (use as fill/icon) |
| Warning (text-safe) | `#B45309` | Use when amber must appear as text on white |
| Danger | `#DC2626` | Do Not Pay, denied claims, missed deadlines, overdue past N days |
| Info | `#0EA5E9` | Acknowledgment sent, neutral status updates (use as fill/icon) |
| Info (text-safe) | `#0369A1` | Use when info-blue must appear as text on white |
| Critical | `#7C3AED` | Legal-bucket claims, high-value escalations (purple — distinct from any urgency color) |
| Neutrals | Tailwind `slate-50` → `slate-950` | Backgrounds, borders, muted text |

**Claim-stage color mapping (default board):**

- Intake → `info` (blue)
- Documenting → `warning` (amber — waiting on parties)
- Investigating → `slate-500` (neutral internal work)
- Carrier Review → `primary` (orange — action with a party)
- Settlement → `accent` (steel blue — negotiation in progress)
- Closed (paid) → `success` (green)
- Denied (side state) → `danger` (red)
- Legal (side state) → `critical` (purple)
- Do Not Pay flag → `danger` background with bold treatment

**Tailwind tokens:** Wired up as `bg-primary`, `text-accent`, `border-danger`, etc. via `@theme inline` in [app/globals.css](app/globals.css). Always prefer semantic tokens over raw `orange-500` / `blue-600` utility classes so future palette changes propagate cleanly.

**Style:** Modern, clean, professional logistics/operations aesthetic — closer to an insurance/claims console (Linear, Stripe Dashboard, Guidewire) than a marketing site.
**Components:** Custom components built on Tailwind CSS, Lucide icons

## Core Features

### 1. Claim Management (Kanban / Board View)

- **Pinnable Claim Cards:** Keep high-exposure or escalated claims visible
- **Columns (draft, configurable):** Intake → Documenting → Investigating → Carrier Review → Settlement → Closed (with side states for Denied / Legal)
- **Card Details:** Claim number, shipper/customer, carrier, BOL reference, claim value bucket (under $10K / Credit-High Value / Legal), date opened, current owner, days open, last activity
- **Quick Actions:** Log call/email, request documentation, send acknowledgment letter, upload evidence, change status, place carrier hold

### 2. Task, Follow-Up & Correspondence System

- **Calendar View:** Visual timeline of acknowledgment deadlines, follow-up cadences, statute/recovery deadlines
- **Task Lists:** Overdue, today, upcoming, completed (typed: "request BOL", "send acknowledgment", "follow up on repair estimate", etc.)
- **Reminders:** Email/in-app notifications for unresponsive parties and approaching deadlines
- **Correspondence Log:** Track every phone call, email, and message with shippers, carriers, factoring companies, accounts payable, and insurers

### 3. Claims Portfolio Tracking

- **Claim Classification:** Current Claims (under $10,000), Credit / High Value Claims, Legal Claims (mirrors the SOP tracking spreadsheets)
- **Carrier Risk Tracking:** "Do Not Pay" flags, payment/dispatch holds, performance notes
- **Party Tracking:** Shipper, customer, carrier, factoring company, accounts payable, insurance carrier per claim
- **Document Vault:** BOLs, signed delivery receipts, photos/videos, witness statements, repair estimates, replacement invoices, presentation-of-loss documents, releases, settlement agreements

## Development Guidelines

### Data Model Priority

1. **Claims Table:** Core entity — claim number, shipper/customer, carrier, BOL ref, intake source (FreightClaims.com / email / phone), value bucket, status, opened/closed dates, owner, exposure amount
2. **Claim Parties Table:** Linked shipper, customer, carrier, factoring company, accounts-payable contact, insurer per claim
3. **Claim Documents Table:** BOLs, PODs, photos, repair estimates, releases, settlement agreements (with type, source, uploaded-by, timestamps)
4. **Tasks Table:** Follow-ups, document requests, acknowledgment deadlines, recovery deadlines linked to a claim
5. **Correspondence Log:** Every call, email, and message linked to a claim and a party
6. **Carrier Holds / Flags:** "Do Not Pay", payment/dispatch holds, monitoring notes, with audit trail
7. **Customers Table (legacy from sales-tracker):** Retained for shipper/customer master data; may be repurposed or replaced — do not extend it without checking the claims data model first
8. **User Preferences:** Pinned claims, view settings, notification preferences

### Business Rules

- **SOP-Aligned Workflow:** Step sequencing should mirror `workspace-docs/claims-sop.txt` (intake → acknowledgment letters → documentation requests → spreadsheet/CRM tracking → carrier monitoring → correspondence → closing)
- **Acknowledgment Automation:** On claim creation, auto-suggest acknowledgment letters to shipper/customer, accounts payable, carrier, and factoring company (if applicable)
- **Document Request Tracking:** Standard request checklist (BOL, signed delivery receipt, pickup/delivery photos, witness statements, repair estimates, presentation of loss) with per-item status
- **Overdue Alerts:** Highlight claims with no party response, missing documents past N days, or approaching statute/recovery deadlines
- **Carrier Holds:** Placing a "Do Not Pay" or dispatch hold requires manager approval and writes an audit entry
- **Value-Bucket Routing:** Claims auto-categorize into Current (<$10K), Credit/High Value, or Legal based on exposure amount and manual flags
- **Pin Limit:** Max 5-10 pinned claims to maintain focus
- **Closure Requirements:** A claim cannot be closed without recorded resolution status, all required closing documents (releases, settlement agreements, payment confirmations), and notification to applicable parties
- **Retention:** Archive closed claims and documents per company retention policy

### Integration Points

- **SendGrid:** Email notifications for task reminders
- **Supabase Realtime:** Live updates when team members update customer status
- **Calendar Export:** iCal integration for external calendars (future)

### Documentation Organization

- **Location:** All `.md` documentation files go in `workspace-docs/` folder
- **Exception:** `README.md` stays in project root
- **Architecture Docs:** `ARCHITECTURE-*.md` for system design documentation
- **Setup Guides:** `*-SETUP.md` for configuration instructions
- **Session Summaries:** `SESSION-SUMMARY-*.md` for development tracking

### Deployment Policy

- **IMPORTANT:** Do NOT deploy to Netlify unless explicitly requested by the user.
- **Reason:** Each deployment incurs build time costs and increases hosting bills
- **User Controls Everything:** The user will handle ALL git commits, pushes, and deployments
- **Exception:** Only deploy if user specifically asks to "deploy" or "push to production"
- **Note:** Do NOT commit or push changes - the user handles version control workflows

### Database Type System

- **Single Source of Truth:** Use `lib/database.types.ts` ONLY (auto-generated from Supabase)
- **Removed Files:** `db/schema.supabase.ts`, `db/schema.ts`, `db/client.ts` (no longer used)
- **Type Pattern:** `Database['public']['Tables']['table_name']['Row']`
- **Regenerate Types:** `npm run db:types` after schema changes
- **Never:** Manually edit `lib/database.types.ts` - it's auto-generated

### Email & Notification System

- **Encrypted Config:** Email credentials stored encrypted in database (`lib/encryption.ts`)
- **Email Service:** `lib/email-service.ts` handles SendGrid integration
- **Scheduled Tasks:** pg_cron in Supabase calls `/api/cron/*` endpoints
- **Backup Scheduling:** Netlify serverless functions in `netlify/functions/`
- **User Preferences:** Per-user notification times and digest preferences

### Component Patterns

#### Context-Aware UI Components

- **Pattern:** Components that adapt content based on current route/page using `usePathname()` hook
- **Reference Implementation:** `components/HelpModal.tsx` with `getHelpTopics()` function
- **How It Works:** Parent passes `currentPath` prop → Component switches content via path detection
- **Adding New Pages:** Update the component's content-switching function (e.g., `getHelpTopics()` in HelpModal)
- **Example:** HelpModal shows different help topics for Power Dialer vs Kanban vs Calendar pages
- **When to Use:** Help systems, contextual navigation, page-specific tooltips/guidance

#### Call Logging & Summarization (Claims Context)

- **Scope:** GoTo Connect integration is retained for **claim-related call logging only** (calls between claims staff and shippers, carriers, factoring companies, insurers, or brokers). Sales-coaching call analysis from the original sales-tracker has been removed from scope.
- **AI Summarization:** Recorded claim calls can be summarized into the claim's correspondence log (key points, commitments made, next steps, party identification). Human review is always required before the summary is treated as authoritative.
- **Linking:** Calls should be attachable to a specific claim and party. Unlinked call recordings stay in a triage view.
- **Trust Boundary:** Recordings and transcripts may contain sensitive customer, carrier, or settlement data — admin/manager-only visibility by default; claims-staff visibility scoped to their assigned claims.

#### AI-Assisted Claim Workflows

- **Document Extraction:** Use AI to extract structured fields from BOLs, PODs, repair estimates, and damage-report PDFs/photos (party names, amounts, dates, damage descriptions) — always presented as draft fields the user reviews before saving.
- **Correspondence Drafting:** "Draft acknowledgment letter", "Draft follow-up to carrier", "Draft settlement offer" using claim context. Human edits before send.
- **Triage & Classification:** Suggested severity, suggested liable party, suggested value bucket — surfaced as recommendations with evidence citations, never as automatic decisions.
- **Settlement Guidance:** Summarize precedent from similar closed claims (after enough historical data exists) to inform negotiation — advisory only.
- **Implementation Pattern:** Follow `app/api/ai/*` conventions — OpenAI client, `gpt-4o-mini` for lightweight text tasks, session/role gating, prompts kept in the route. Coordinate persistence with `supabase-specialist` and source-material handling with `ai-architect`.

#### Location Input Fields & Geocoding

- **API:** Zippopotam.us (https://api.zippopotam.us/us/{zipCode})
- **Pattern:** Auto-lookup city/state from postal code for better UX
- **When to Use:** ANY location input field (origin, destination, customer address, etc.)
- **Implementation Example:**
  ```typescript
  const lookupZipCode = async (zipCode: string) => {
    if (!zipCode || zipCode.length !== 5) return;
    
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      if (response.ok) {
        const data = await response.json();
        const city = data.places[0]?.["place name"];
        const state = data.places[0]?.["state abbreviation"];
        // Auto-fill city/state fields
      }
    } catch (error) {
      console.error('Zip lookup failed:', error);
    }
  };
  ```
- **UX Pattern:** 
  - User types 5-digit zip → Auto-fill city/state fields
  - Show loading indicator during lookup
  - Fallback: Allow manual city/state entry if zip lookup fails
- **Cost:** Free, no rate limits, no API key required
- **Reference:** See `app/dashboard/carrier-finder/page.tsx` lines 216-235 for production example

---

## ⚙️ Once Configured, Replace Above Section With:

```markdown
## Project Overview

**Application Name:** [Your App Name]  
**Purpose:** [What it does]  
**Target Users:** [Who uses it]

## Technology Stack

**Backend:** [Chosen backend]  
**Database:** [Database choice]  
**Authentication:** [Auth solution]  
**Deployment:** [Deployment platform]

## Design System

**Colors:**

- Primary: [hex/name]
- Secondary: [hex/name]
- Accent: [hex/name]

**Style:** [Design approach]  
**Components:** [Component library]

## Development Guidelines

[Any specific patterns, conventions, or requirements]
```

---

## 🌍 Global Development Preferences

These preferences apply to ALL projects unless explicitly overridden:

### Code Quality

- **Professional and Clean:** No emojis in production code or user-facing UI unless explicitly requested
- **Descriptive Naming:** Use clear, descriptive variable/function names, avoid abbreviations
- **Comments:** Add comments for complex logic, not obvious code
- **DRY Principle:** Extract reusable functions instead of duplicating code
- **Follow Existing Patterns:** Match the codebase's existing style and patterns

### AI-First Feature Design (PREFERENCE)

- **Default to adding AI where it helps:** Whenever a feature is created or revised, consider whether AI could meaningfully improve the experience (drafting, summarizing, suggesting, classifying, etc.). If it makes sense, build it in.
- **Don't force it:** Only add AI where it genuinely adds value. Skip it when it would add friction, latency, or noise without a clear payoff. When unsure, propose it rather than silently omitting it.
- **Reuse the existing AI stack:** Follow the patterns in `app/api/ai/*` (OpenAI client, `model: "gpt-4o-mini"` for lightweight text tasks), gate endpoints by session/role, and keep prompts in the route.
- **Examples of good fits:** "Write/Improve with AI" buttons on free-text fields (e.g., the maintenance message), summaries of long content, auto-suggested values, and context-aware drafting.
- **Always keep the human in control:** AI output is a starting point. Let the user review/edit before it's saved or sent.

### Architecture

- **Component Organization:** Keep components focused on single responsibility
- **Error Handling:** Always include try/catch for async operations
- **Type Safety:** Leverage TypeScript fully, avoid `any` types
- **Validation:** Validate user input before processing

### API & Backend

- **Consistent Responses:** Use consistent JSON response format (success: {data}, error: {error})
- **Security First:** Parameterized queries, input validation, proper authentication checks
- **Status Codes:** Return appropriate HTTP status codes (401 auth, 400 validation, 500 server)
- **Error Messages:** User-friendly error messages, detailed logs for debugging

### Frontend

- **Async/Await:** Use async/await instead of callbacks
- **Loading States:** Show loading indicators for async operations
- **Error Handling:** Display user-friendly error messages, handle 401s appropriately
- **Accessibility:** Minimum 4.5:1 contrast ratio, semantic HTML, keyboard navigation

### CSS & Styling

- **Mobile-First (CRITICAL):** Responsive design starting from mobile breakpoint (320px+)
  - All components must be fully functional on mobile devices
  - Touch-friendly targets (minimum 44x44px tap areas)
  - PWA-ready with mobile app-like experience
  - Future React Native migration planned - keep components modular
  - Urgent tasks happen 24/7, not just during office hours - mobile access essential
- **Tailwind CSS v4 Syntax:** Use modern v4 class names to avoid deprecation warnings
  - ✅ `bg-linear-to-*` NOT `bg-gradient-to-*` (gradients)
  - ✅ `shrink-*` NOT `flex-shrink-*` (flexbox)
  - ✅ `grow-*` NOT `flex-grow-*` (flexbox)
  - ✅ `basis-*` NOT `flex-basis-*` (flexbox)
  - See: https://tailwindcss.com/docs/upgrade-guide
- **Semantic Classes:** Use meaningful class names (`.user-profile`, not `.box1`)
- **Organization:** Group related styles with comments
- **Consistency:** Maintain consistent spacing, typography, colors
- **Responsive Breakpoints:** sm: 640px, md: 768px, lg: 1024px, xl: 1280px

### Git & Version Control

- **Descriptive Commits:** Clear commit messages explaining changes
- **Atomic Commits:** One logical change per commit when possible
- **Branch Naming:** Use descriptive branch names (feature/_, fix/_, refactor/\*)

---

## 🎯 Project-Specific Instructions

### Claims Terminology

- **Claim:** A formal report of loss, damage, or service failure related to a shipment
- **Shipper / Customer:** The party whose freight is the subject of the claim
- **Carrier:** The trucking company that moved (or was to move) the freight
- **BOL (Bill of Lading):** Primary shipment contract and the document where damage notations must appear at delivery
- **POD (Proof of Delivery):** Signed delivery receipt, often required for damage claims
- **Presentation of Loss:** Formal documentation packet establishing the claimed loss amount
- **Factoring Company:** Third party that funds a carrier's receivables; often notified of claims affecting carrier payment
- **Accounts Payable (AP):** Internal NTS team notified so payment to a carrier can be held pending resolution
- **Do Not Pay:** Carrier-level status preventing further payments until claim is resolved
- **Acknowledgment Letter:** Initial outbound notice sent to involved parties when a claim is opened
- **Subrogation / Recovery:** Pursuing reimbursement from a liable party or their insurer
- **Closing Documents:** Releases, settlement agreements, payment confirmations required before a claim is closed
- **Value Buckets:** Current Claims (<$10K) / Credit-High Value / Legal — mirrors the SOP tracking spreadsheets

### Legacy Sales-Tracker Terminology (Avoid)

- Do not introduce new code or copy using: "prospect", "book of business", "shipping frequency", "opportunity", "won/lost", "sales pipeline", "qualifying questions", "AE/account executive" (unless referencing the broker who owns the underlying customer relationship). These come from the upstream sales-tracker and do not apply to claims workflows.

### UI/UX Priorities

1. **Hyperfocused Workspace (CRITICAL):** This application is designed to maximize focus and minimize distractions
   - **Only notify users about actions they DIDN'T initiate** (e.g., admin assigns them a customer)
   - **Never create self-notifications** (e.g., user assigns contact to self = no notification needed)
   - Users already know what they just did - don't tell them again
   - Every notification should be actionable and important
   - When in doubt about adding a notification, default to NOT adding it
2. **Mobile-First:** All features must work seamlessly on mobile (PWA-ready, 24/7 access)
3. **Speed:** Brokers need to log activities quickly between calls
4. **Visibility:** Important customers and tasks must be immediately visible
5. **Touch-Optimized:** Large tap targets (44x44px minimum), swipe gestures where appropriate
6. **Minimal Clicks:** Common actions (log call, schedule follow-up) in 1-2 clicks
7. **Admin Efficiency:** When adding admin features (modals, forms, etc.), include options to set roles/permissions upfront to avoid extra steps later

### Database Naming Conventions

- Use claims-domain terms: `claim`, `claim_party`, `claim_document`, `correspondence_log`, `carrier_hold`
- Retain legacy generic tables (`customers`, `brokers`, `tasks`, `contact_log`) where they still apply, but new domain tables should use claims naming
- Timestamp all activities: `opened_at`, `acknowledged_at`, `last_party_response_at`, `closed_at`, `due_at`
- Audit-friendly: every status change, hold, and document upload should be attributable to a user and timestamped
- Email tracking: `last_reminder_sent_date`, `digest_time` for user preferences

### Security & Access

- Row-Level Security (RLS) in Supabase, by role:
  - **Claims staff:** Full read/write on claims they own or are assigned to; read on team queue
  - **Brokers:** Read and comment access on claims tied to customers they own (no edits to claim status, holds, or settlement data)
  - **Managers / Admins:** Full visibility across all claims, holds, and reporting; required for approving "Do Not Pay" and payment holds
  - **External carriers (future, not yet in scope):** If introduced, scope tightly to the specific claim and limited fields; never expose other carriers' data or internal notes
- Audit trail: Track who created, modified, or closed any claim record; track every status change, hold placement/removal, document upload, and outbound correspondence
- Sensitive data: BOLs, settlement amounts, and legal-bucket claims may carry additional access restrictions

---

## 📋 Quick Reference

### Before Making Changes

1. ✅ Project configuration is complete (section above filled in)
2. ✅ Understand the user's intent and context
3. ✅ Review existing code patterns
4. ✅ Consider security implications
5. ✅ Ensure changes are testable

### When Uncertain

- Ask clarifying questions instead of making assumptions
- Suggest options and let user decide
- Explain trade-offs for different approaches

### Common Scenarios

**Database Changes:**

- Update schema files
- Create/run migrations
- Update TypeScript types
- Update related API endpoints

**New Features:**

- Follow existing file structure
- Match current naming conventions
- Add proper error handling
- Consider edge cases

**Bug Fixes:**

- Understand root cause before fixing
- Add validation to prevent recurrence
- Test related functionality

**Scheduled Tasks:**

- Use pg_cron in Supabase for database-level scheduling
- Add Netlify serverless functions as backup/alternative
- Exclude `/api/cron/*` routes from auth in middleware.ts
- Test locally with curl before deploying

---

## 🔄 Maintaining This File

**After Initial Setup:**

1. Remove the "PROJECT CONFIGURATION REQUIRED" section
2. Fill in all project-specific details
3. Update as project evolves (new services, changed patterns, etc.)
4. Keep it current with the actual codebase

**This file should be a living document that reflects the current project state.**

---

**Last Updated:** February 1, 2026
**Project Status:** ✅ ACTIVE DEVELOPMENT - Email notifications & task scheduling implemented
