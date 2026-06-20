# Development Agenda - Future Enhancements

**Priority tracking for features and improvements to implement later**

---

## 📧 Email System Enhancements

### 1. Challenge Email Deep Links with Prefilled Forms

**Status:** Planned  
**Priority:** Medium  
**Effort:** Medium

**Description:**  
When users receive "no tasks" challenge emails (e.g., "Make 50 calls in 3 hours"), clicking the CTA should open the task creation form with pre-filled data based on the challenge.

**Requirements:**

- [ ] Add URL search params support to task form (`?title=...&description=...&type=...`)
- [ ] Update challenge email CTAs to include challenge-specific params
- [ ] Example: `https://sales.ntsconnect.com/dashboard/tasks?title=Cold+Call+Sprint&description=Make+50+calls+in+3+hours&type=prospecting&priority=high`
- [ ] Handle encoding/decoding of params in TaskFormModal component
- [ ] Add "From Challenge" badge when form is prefilled from email link

**Technical Notes:**

- Use `useSearchParams()` from next/navigation
- Merge URL params with form defaults
- Consider adding `source=email` param for analytics

---

### 2. Database-Driven Email Template Editor

**Status:** Planned  
**Priority:** Low  
**Effort:** High

**Description:**  
Currently, email templates are hardcoded in `lib/email-templates.ts`. Move them to the database and connect the existing `EmailTemplateEditor.tsx` admin component to allow non-technical editing.

**Requirements:**

- [ ] Create `email_templates` table in Supabase
  - Columns: id, name, category (no_tasks, task_reminder, etc.), subject, body_html, tokens, is_active, created_at
- [ ] Create `user_email_preferences` table for per-user template settings
  - Columns: broker_id, no_tasks_strategy (random, sequential, specific_id), preferred_template_ids
- [ ] Connect `EmailTemplateEditor.tsx` to database (CRUD operations)
- [ ] Update `generateDailyDigestHTML()` to fetch templates from DB instead of hardcoded array
- [ ] Add template preview/test send functionality
- [ ] Implement template versioning (track changes, rollback capability)
- [ ] Add no-tasks email strategy selector in user settings:
  - Random rotation (current behavior)
  - Sequential (cycle through in order)
  - Specific template only
  - Manager-assigned (admins set which templates each broker receives)

**Technical Notes:**

- Use Unlayer or React Email for drag-and-drop editing (recommended in EmailTemplateEditor.tsx)
- Store tokens/variables as JSONB for validation
- Add RLS policies for admin-only template editing
- Consider adding A/B testing for email effectiveness

---

### 3. AI-Powered Email Generation

**Status:** Planned  
**Priority:** Low  
**Effort:** High

**Description:**  
Integrate AI (OpenAI or self-hosted Ollama) to generate personalized email content, improve templates, and suggest follow-up strategies.

**Email-Specific AI Features:**

- [ ] Generate personalized "no tasks" email variations based on broker history
  - Example: If broker has been idle for 3+ days, use more aggressive tone
  - Example: If broker is new, use encouraging/educational tone
- [ ] AI-suggested email templates based on customer industry
- [ ] Smart follow-up email generation based on previous interactions
- [ ] Email subject line optimization (test multiple AI-generated options)
- [ ] Tone adjustment (professional, friendly, urgent) based on customer relationship stage

**Broader AI Integration Ideas:**

- [ ] Task prioritization suggestions
- [ ] Customer sentiment analysis from contact log notes
- [ ] Automated task creation from email/calendar events
- [ ] Smart scheduling (best time to call based on customer patterns)
- [ ] Deal probability scoring
- [ ] Automated CRM data enrichment (company info, industry trends)

**Technical Stack Options:**

- **OpenAI GPT-4:** Easiest integration, best quality, costs per API call
- **Ollama (self-hosted):** Free, full control, requires server setup
  - Models: Llama 3, Mistral, Mixtral
  - Host on Railway, Render, or dedicated VPS
- **Anthropic Claude:** Alternative to OpenAI, strong reasoning

**Implementation Approach:**

1. Start with OpenAI for MVP (fastest to implement)
2. Build abstraction layer (`lib/ai-service.ts`) so provider is swappable
3. Later: Set up Ollama on separate server and switch provider via env var
4. Add cost tracking and usage limits per broker/team

**API Endpoints Needed:**

- `/api/ai/generate-email` - Generate email content
- `/api/ai/suggest-tasks` - AI task recommendations
- `/api/ai/analyze-pipeline` - Pipeline health insights

---

## 🎯 Current Email System Status

**✅ Completed:**

- Daily digest email system with task categorization (Overdue → Today → Upcoming)
- 5 randomized "no tasks" email variations to prevent email fatigue
- Priority-based formatting with emojis
- User preference controls (email types, digest time, notification settings)
- SendGrid integration with encrypted API keys
- pg_cron scheduled jobs for automated sending

**🔄 In Progress:**

- Testing with limited users (only Noah's accounts receiving digests)
- Monitoring email delivery rates and engagement

**📋 Next Steps:**

1. Create `AGENDA.md` file ✅ (this file)
2. Run SQL to disable daily_digest for all except Noah's accounts
3. Monitor Noah's inbox for email variations and engagement
4. Collect feedback on tone, content, effectiveness
5. Decide on next email enhancement to implement

---

## 📝 Notes

- Keep email enhancements separate from core CRM features
- All AI features should have manual override/disable option
- Email template changes should be A/B testable
- Consider email fatigue - don't over-automate

**Last Updated:** February 1, 2026  
**Maintained By:** Development Team
