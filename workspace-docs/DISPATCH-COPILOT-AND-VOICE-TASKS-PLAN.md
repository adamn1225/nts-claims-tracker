# Dispatch Co-Pilot — Rename + Voice Task Commands (Planning)

> Status: **Planning only — not yet built.** Captured from the 2026-06-09
> discussion. Two related initiatives: (A) rename the assistant to
> **Dispatch Co-Pilot**, and (B) add Siri-style voice commands for creating
> tasks. Sales coaching remains the assistant's primary purpose.

---

## A. Rename: "AI Sales Coach" → "Dispatch Co-Pilot"

### Why
The widget already does sales coaching, contextual page help, and (admin) an
assistant mode — and voice task creation is coming. "AI Sales Coach" is too
narrow. "Dispatch Co-Pilot" keeps the freight-native "Dispatch" framing and the
"rides shotgun in the cab" Co-Pilot metaphor, and avoids confusion with GitHub
Copilot. Existing modes (Sales / Admin) become sub-labels under the new name.

### Naming convention to apply
- Product/UI name: **Dispatch Co-Pilot**
- Default (sales) mode label: keep "Sales Coach" as a mode, or "Sales"
- Admin mode label: "Admin Assistant" (unchanged)
- Keep code identifiers (`AiCoach*`, `useAiCoach`, `ai-coach/`, route
  `/api/ai/sales-coach`) AS-IS for now to avoid churn — this is a **UI/string
  rename only**. A deeper code rename can be a separate pass if desired.

### User-facing strings to update (UI only)
- `components/ai-coach/AiCoachHeader.tsx`
  - Title: `mode === "admin" ? "Admin Assistant" : "Dispatch Co-Pilot"`
    (line ~143)
  - Export filename label `'AI Sales Coach'` (line ~63)
  - Conversation export headers `# AI Sales Coach Conversation` (lines ~79-80)
    → `# Dispatch Co-Pilot Conversation`
  - Subtitle/help text "General sales coaching • ..." (line ~233)
- `components/ai-coach/AiCoachFAB.tsx`
  - Comment + `aria-label="Open AI Sales Coach"` (lines ~8, ~31)
  - `title` tooltip wording (line ~32)
- `components/ai-coach/AiCoachAgentSwitcher.tsx`
  - Header comment references (lines ~9-11); mode label "Sales Coach" (line ~26)
- `components/ai-coach/index.ts`
  - Header comment "AI Sales Coach Components" (line ~2)
- Any popout window title / docked button labels referencing "Sales Coach".

### Out of scope for the rename pass
- Folder/file/identifier renames (`ai-coach`, `AiCoach*`, `useAiCoach`,
  `/api/ai/sales-coach`, `ai_chat_history` mode values). Leave as internal names.
- The company-wide "Call Quality Coaching" tool — different feature, keep name.

---

## B. Voice Task Commands (Siri-style)

### Goal
Let brokers create (and later edit/complete) tasks by speaking, e.g.
"Remind me to follow up with Acme Logistics tomorrow at 3 about their reefer
load." Brokers already lean on Siri; this brings that speed into the CRM.

### Key decision: NO MCP for the in-app feature
MCP is a protocol for letting **external** agents (Claude Desktop, the existing
`mcp-server-carrier`) call our tools. For an in-app voice button, MCP only adds
a network hop + latency — the browser is already authenticated and can call our
own API directly. MCP is a good **Phase 2** (expose a `create_task` tool so the
assistant and external agents can manage tasks), but it must NOT block the voice
feature.

### Architecture (in-app)
```
🎤 Mic button → Speech-to-text → AI parse route (structured JSON)
   → Confirm card (broker edits/approves) → Create task (session-auth)
```

1. **Speech-to-text**
   - Primary: Browser **Web Speech API** (`SpeechRecognition` /
     `webkitSpeechRecognition`). Free, no key, low latency. Works in
     Chrome/Edge/Safari (what brokers use). No existing usage in the repo today.
   - Fallback: **OpenAI `gpt-4o-transcribe` / Whisper** via a new API route for
     browsers without Web Speech (Firefox, some mobile). Record audio →
     upload → transcribe.
   - Mobile-first: large 44x44px+ mic button; handle mic permission prompts and
     denied state gracefully.

2. **Intent parsing** — new route `app/api/ai/voice-task/route.ts`
   - Session + role gated (match existing `app/api/ai/*` patterns).
   - Model `gpt-4o-mini`; use **structured outputs / function-calling** to emit:
     `{ title, type, due_date, due_time, customer (name/query), priority,
       description }`.
   - Resolve relative dates ("tomorrow at 3", "next Tuesday", "in 2 hours")
     server-side using the broker's timezone.
   - Return a parsed draft + any low-confidence flags (e.g. ambiguous customer).

3. **Confirm-before-create (REQUIRED)**
   - Voice is error-prone and the project's AI-first rule keeps the human in
     control. Show a compact parsed-task card:
     "Follow-up call · Acme Logistics · Tomorrow 3:00 PM · High — Create?"
   - Allow inline edits before saving.
   - Fuzzy customer match → "Did you mean **Acme Logistics**?" picker when the
     spoken name doesn't exactly match a customer.

4. **Create task**
   - Use the **in-app session-authed** create path, NOT `app/api/v1/tasks`
     (that POST is token-auth for external API consumers).
   - Task schema (confirmed from `lib/database.types.ts` → `tasks`):
     - Required: `title`, `due_date`
     - Optional: `type`, `due_time`, `customer_id`, `priority`, `description`,
       `status` (defaults to "pending"), `task_category`, `reminder_days`,
       `requires_acceptance`
     - System: `broker_id` (force to session user), `created_by`

### Entry points
- A mic button inside the **Tasks** page (primary), and/or
- A mic affordance inside **Dispatch Co-Pilot** (so voice routes through the
  assistant once Phase 2 tool-calling exists).

### Phasing
- **Phase 1 (in-app voice):** Web Speech → `/api/ai/voice-task` parse →
  confirm card → create. Whisper fallback. Tasks page entry point.
- **Phase 2 (MCP, optional):** Expose `create_task` (and `list_tasks`,
  `complete_task`) as MCP tools so Dispatch Co-Pilot's tool-calling — and
  external agents — can manage tasks. Voice then becomes one input into the same
  tool. Reuse existing `mcp-server-carrier` patterns.

### Open questions / to decide before building
- Which browsers/devices must be supported on day 1 (decides whether Whisper
  fallback is Phase 1 or later)?
- Beyond create: do we want voice for **complete task**, **reschedule**,
  **add note**, or create-only first?
- Confirm card UX: modal vs. inline toast vs. inside the Co-Pilot panel.
- Customer matching source (search existing customers by spoken name) and
  behavior when no match (create task without customer link vs. block).
- Timezone source for relative-date resolution (broker profile vs. browser tz).

---

## Related already-shipped context
- Assistant widget code lives under `components/ai-coach/*` with
  `contexts/AiCoachContext.tsx` (modes: `sales | help | admin`) and route
  `app/api/ai/sales-coach/route.ts`.
- Tasks API: in-app create path + external `app/api/v1/tasks` (token-auth).
- Existing MCP infra: `mcp-server-carrier/`, `MCP-implementation.md`.
