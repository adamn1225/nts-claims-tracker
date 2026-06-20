# NTS Claims Tracker — Chrome Extension

A lightweight companion to the NTS Claims Tracker web app. Manage your tasks and
capture new customers from a Chrome popup — and pop it out into a sticky-note
window that floats next to your other work.

It talks **directly to Supabase** (auth + REST) using your existing login, so
there's no separate backend and no build step.

## Features

- Sign in with your normal NTS Claims Tracker email + password
- See your open tasks (pending + overdue), soonest first
- One-click "complete" on any task
- Add a task (title, type, priority, due date/time, link to a customer, notes)
- Add a customer (business, contact, email, phone, status, industry, notes) —
  the status dropdown uses **your own pipeline statuses** from the web app
- A red **toolbar badge** shows how many tasks are currently overdue
- **Pop out** the popup into a standalone sticky-note window (↗ button)

Row Level Security still applies — you only ever see and edit your own records.

## Install (developer mode)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Select this `chrome-extension/` folder

The NTS icon appears in your toolbar. Pin it for quick access.

## First-run setup

On first launch the extension asks for two values (the same public ones the web
app uses — they live in the project's `.env.local`):

- **Supabase URL** — e.g. `https://xxxx.supabase.co` (`NEXT_PUBLIC_SUPABASE_URL`)
- **Anon key** — the long `eyJhbGci...` string (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)

These are stored locally in `chrome.storage.local`. The anon key is a public
client key (safe to use in a browser), not the service-role key.

Then sign in with your email + password.

## Pop-out (sticky note)

Click the **↗** button in the header to open the popup as a small always-
available window you can move and resize. Close it like any window when done.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest (storage + alarms permission, Supabase host access) |
| `popup.html` / `popup.css` | UI |
| `popup.js` | View flow, task list, forms, pop-out |
| `background.js` | Service worker that keeps the overdue-count badge in sync |
| `supabase-api.js` | Minimal Supabase auth + REST wrapper (fetch only) |
| `icons/` | Toolbar icons |

## Notes / future ideas

- If your Supabase project uses a **custom domain**, update `host_permissions`
  in `manifest.json` (currently `https://*.supabase.co/*`).
- The overdue badge refreshes every 5 minutes, on browser startup, and right
  after you add/complete a task in the popup.
- Possible next steps: edit/snooze tasks, search customers, and a right-click
  "add customer from selected text" context menu.
