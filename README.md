# Claims Tracker Starter

An industry-agnostic sales CRM boilerplate. Track contacts through a pipeline,
manage follow-up tasks, and coach your team — with optional AI assistance,
calling integration, and email notifications. Rebrand it for any industry by
editing a single config file.

Built with **Next.js (App Router) + Supabase + Tailwind v4 + TypeScript**.

## Features

- **Pipeline board (Kanban)** — drag contacts across customizable stages, pin
  priority accounts, filter and search.
- **List & calendar views** — the same book of business as a table or a
  follow-up calendar.
- **Tasks & follow-ups** — priorities, due dates, overdue alerts, completion
  logging.
- **Admin console** — manage users & roles, reassign contacts, feature access,
  email templates/broadcasts, app updates, and maintenance mode with an
  activity heatmap and online-users indicator.
- **AI assistant** _(optional)_ — a context-aware sales coach + email drafting,
  built on OpenAI. No vendor-specific knowledge base.
- **GoTo Connect calling** _(optional)_ — click-to-call, call sessions, and
  AI call-quality coaching.
- **Email notifications** _(optional)_ — reminders and a daily digest via
  SendGrid, scheduled with Supabase `pg_cron`.
- **Chrome extension** companion for quick capture.

## Rebrand for your industry

Everything industry-specific lives in [`config/app.config.ts`](config/app.config.ts):

- **`brand`** — product name, company, logo, support email, tagline.
- **`theme`** — colors (feed the Tailwind theme).
- **`terms`** — display labels for contacts/users and your pipeline stages.
  (Internal code and DB tables keep stable identifiers; only labels change.)
- **`industries`** / **`contactFrequencies`** — dropdown options.
- **`features`** — toggle GoTo, AI, call coaching, Microsoft SSO, maintenance
  mode, the Chrome extension, and email notifications on or off.

Change those values and the app rebrands without touching components.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local   # then fill in your keys

# 3. Set up the database
#    Run the SQL files in supabase/migrations/ in your Supabase SQL editor
#    (in filename order), then generate types:
npm run db:types

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000.

### Required services

| Service  | Why                           | Required?                          |
| -------- | ----------------------------- | ---------------------------------- |
| Supabase | Database, auth, realtime      | Yes                                |
| OpenAI   | AI assistant & coaching       | When `features.ai` is on           |
| SendGrid | Email reminders & digests     | When `features.emailNotifications` |
| GoTo     | Calling & call recordings     | When `features.goto` is on         |
| Tavily   | AI web research (sales coach) | Optional                           |
| Mapbox   | Maps in location features     | Optional                           |

## Project structure

```
app/            Next.js routes (dashboard, api, auth)
components/     UI components (Kanban, ListView, calendar, modals, admin)
config/         app.config.ts — branding, terms, feature flags
contexts/       React context providers (sidebar, presence, AI coach, etc.)
lib/            Supabase clients, email, notifications, helpers, types
supabase/       SQL migrations
chrome-extension/  Companion browser extension
```

## Database types

`lib/database.types.ts` is generated from your Supabase schema. After changing
the schema, regenerate it:

```bash
npm run db:types
```

Never hand-edit that file.

## Deployment

Deploys cleanly to Netlify or Vercel. Set the environment variables from
`.env.example` in your host, and schedule the `/api/cron/*` endpoints (via
Supabase `pg_cron` or your host's scheduler) if you use email notifications.

## License

See [LICENSE](LICENSE).
