# yCopilot Instructions - Project Configuration

> **⚠️ IMPORTANT: This file needs to be configured before development begins.**
> Replace the "PROJECT CONFIGURATION REQUIRED" section below with actual project details.

---

## Project Overview

**Application Name:** NTS Claims Tracker
**Purpose:** A freight broker CRM focused on customer follow-ups, task management, and opportunity tracking. Replaces sticky notes and manual tracking with a centralized system for managing customer relationships and sales pipeline.
**Target Users:** Freight brokers and sales team members at Nationwide Transport Services (NTS/Heavy Haulers)

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

- Primary: #E85D04 (NTS Orange - from logo)
- Secondary: #1A1A1A (Dark slate)
- Accent: #FFA726 (Light orange for highlights)
- Success: #10B981 (Green for completed tasks)
- Warning: #F59E0B (Amber for pending)

**Style:** Modern, clean, professional logistics/transportation aesthetic
**Components:** Custom components built on Tailwind CSS, Lucide icons

## Core Features

### 1. Customer Management (Kanban Board)

- **Pinnable Customer Cards:** Keep high-priority clients visible
- **Columns:** Prospect → Active → Won → Lost
- **Card Details:** Contact info, shipping frequency, industry, last contact
- **Quick Actions:** Call, email, schedule follow-up

### 2. Task & Follow-Up System

- **Calendar View:** Visual timeline of scheduled follow-ups
- **Task Lists:** Overdue, today, upcoming, completed
- **Reminders:** Email/in-app notifications for upcoming tasks
- **Contact Log:** Track all interactions with each customer

### 3. Book of Business Tracking

- **Client Classification:** Prospect vs. Active Client
- **Shipping Frequency:** Multiple per week, weekly, bi-weekly, monthly, quarterly, yearly
- **Industry Tracking:** Categorize clients by industry type
- **Location Data:** City/State for territory management

## Development Guidelines

### Data Model Priority

1. **Customers Table:** Core entity with contact details, classification, shipping frequency
2. **Tasks Table:** Follow-ups, reminders, calendar events linked to customers
3. **Contact Log:** Activity history for each customer interaction
4. **User Preferences:** Pinned cards, view settings, notification preferences

### Business Rules

- **Follow-Up Automation:** Suggest next contact date based on shipping frequency
- **Overdue Alerts:** Highlight customers without recent contact
- **Pin Limit:** Max 5-10 pinned customers to maintain focus
- **Task Completion:** Archive completed tasks, maintain history

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

#### Call Quality Coaching Tool (Company-Wide)

- **Location:** `/dashboard/performance` → "Coaching" tab (admin-only)
- **Scope:** Works for ALL company GoTo users (120+ users), NOT just CRM users (5 users)
- **Purpose:** Analyze call recordings to detect missing qualifying questions for sales coaching
- **Implementation:** Uses GoTo `userKey` to analyze any company user's calls, regardless of CRM access
- **API Endpoint:** `/api/ai/analyze-call-quality` - Accepts `userKey` (primary) or `brokerId` (legacy)
- **Data Source:** GoTo Connect API recordings + OpenAI GPT-4 transcript analysis
- **Key Point:** This is NOT a self-service tool for individual brokers - it's strictly for managers/coaches to review team performance
- **Note:** Only ~5 out of 120 brokers use this CRM, but all 120+ can be analyzed via this tool

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

### Freight Broker Terminology

- **Customer/Client:** Companies that ship freight
- **Prospect:** Potential customer not yet converted
- **Book of Business:** A broker's portfolio of customers and prospects
- **Shipping Frequency:** How often a customer needs transportation services
- **Follow-Up:** Scheduled contact to maintain relationship or close deal
- **Contact Log:** History of interactions (calls, emails, meetings)

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

- Use freight industry terms: `customer`, `shipment_frequency`, `contact_log`
- Avoid generic terms like `items` or `users` (use `brokers`)
- Timestamp all activities: `last_contact_date`, `next_follow_up_date`
- Email tracking: `last_reminder_sent_date`, `digest_time` for user preferences

### Security & Access

- Row-Level Security (RLS) in Supabase: Brokers see only their assigned customers
- Managers/Admins: Can view team-wide data and reports
- Audit trail: Track who modified customer records and when

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
