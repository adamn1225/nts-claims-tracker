# NTS Claims Tracker Demo Runbook

## Demo goal

Show one connected story: a claim arrives, the team triages it, works it to
resolution, controls carrier risk, and gives management visibility.

Target length: 20–25 minutes, plus questions.

## Before the meeting

- Use an admin or manager account so every feature is visible.
- Apply the latest database migrations and confirm the six `DEMO` carriers
  appear under **Companies**.
- Create or identify one polished demo claim with:
  - a carrier party attached;
  - a claim amount, shipment value, claim type, freight type, and owner;
  - at least two documents;
  - one open task;
  - one note or activity event;
  - one transaction if you want the financial section populated.
- Open these pages in separate tabs:
  1. Dashboard
  2. Claims Track
  3. Claims List
  4. Your prepared claim
  5. Companies, filtered to carriers
  6. Reports
- Keep a backup screenshot or short recording available in case Wi-Fi or an
  external service fails.
- Say explicitly that MCP and Central Dispatch results are labeled sandbox/mock
  data until credentials are provisioned.

## The story to tell

> Today, claims information is often spread across email, documents,
> spreadsheets, and individual follow-up habits. This system creates one
> operational record from intake through recovery and reporting.

## Recommended walkthrough

### 1. Start on Dashboard — 2 minutes

Show:

- portfolio totals and urgent work;
- aging or overdue indicators;
- recent activity;
- shortcuts into active claims.

Say:

> This is the morning view. It answers: what needs attention, where is our
> exposure, and what is at risk of falling through the cracks?

Ask:

- Which three numbers do you need first thing every morning?
- Is urgency driven by age, dollar value, customer importance, filing
  deadlines, or a combination?
- Who should see the whole portfolio versus only assigned claims?

### 2. Show Claims Track — 2 minutes

Show:

- the claim stages;
- drag-and-drop movement between stages;
- owner, amount, carrier, and risk indicators on cards.

Say:

> The board is the operational flow. A claim has a clear stage and owner, so
> the team can see bottlenecks without asking for a status update.

Ask:

- Do these columns match how your team actually works?
- What must be true before a claim moves to the next stage?
- Which movements should notify a manager or another department?

Tip: move only one prepared claim. Avoid rearranging several cards during the
demo.

### 3. Switch to Claims List — 3 minutes

Show:

- search by claim, customer, or carrier;
- sorting and filters;
- filing status;
- value/risk buckets;
- do-not-pay carrier filter.

Say:

> The board is best for workflow; the list is best for investigation,
> prioritization, and answering a specific operational question.

Use one concrete example:

> Show me open, high-value claims where the carrier has a do-not-pay hold.

Ask:

- Which filters do you use repeatedly today?
- What columns must be exportable?
- What does your current spreadsheet show that this view still needs?

### 4. Open a Claim — 7 minutes

Walk top to bottom rather than clicking every control.

Show:

- claim number, owner, stage, claim type, and filing status;
- shipment facts, parties, dates, and claim amount;
- document upload/type and AI extraction;
- notes and activity history;
- tasks and follow-up ownership;
- transactions/recoveries;
- carrier verification and Central Dispatch linking.

Suggested narrative:

> A concealed-damage claim arrives for temperature-sensitive freight. We assign
> an owner, confirm it has been filed with the carrier, and keep the evidence,
> follow-ups, and money events on the same record.

For documents:

> Instead of retyping a bill of lading or police report, the system extracts
> useful fields for review. A person remains responsible for confirming the
> result.

For filing status:

> Workflow status tells us where our team is working. Filing status separately
> tells us whether the carrier has formally received and acknowledged the claim.

For transactions:

> The original claim amount is exposure. Transactions show who actually paid:
> carrier, insurer, NTS, broker, shipper, or another party.

For integrations:

> These cards show the intended carrier-verification and source-order workflow.
> Today they return clearly labeled mock data; the UI and storage path are ready
> for vendor credentials.

Ask:

- What information is mandatory before a claim can be filed?
- Who owns carrier follow-up, and how often should reminders occur?
- Do you need approval before placing a carrier on hold?
- Which documents are most often missing?
- When is a claim considered closed: customer paid, recovery completed, or
  both?

### 5. Show Claim Intake — 3 minutes

Show:

- the external intake form or an existing submission;
- structured shipment, damage, and claim-type fields;
- attachments;
- the review/promote step into a live claim.

Say:

> Intake separates unreviewed submissions from the official claim book. The
> team can check for completeness and duplicates before promotion.

Ask:

- Who submits claims today: customers, brokers, internal staff, or all three?
- Should different customers receive branded or prefilled links?
- What should happen automatically after submission?

Tip: use a prepared submission unless form entry is itself a key buying
criterion.

### 6. Show Companies and Carrier Risk — 3 minutes

Filter **Kind** to **Carrier**. Search for `DEMO`.

Show:

- carrier identity using MC, DOT, and SCAC identifiers;
- verified, flagged, expired, and pending examples;
- `DEMO Harbor Freight Carriers` and its do-not-pay hold;
- notes and claim history on a company record.

Say:

> Carrier risk belongs to the carrier, not only to one claim. A hold is visible
> anywhere that carrier appears, reducing the chance of paying while a claim is
> unresolved.

Ask:

- Who can request, approve, and release a hold?
- Should a hold block payment automatically or warn the user?
- How fresh must insurance and authority verification be?
- Do you distinguish payment holds from dispatch holds?

### 7. Finish on Reports — 3 minutes

Show:

- open/closed exposure and aging;
- owner and office breakdowns;
- carrier exposure;
- claim-type patterns;
- freight-type closure rates and average claim amount;
- payment-source/recovery information if populated.

Say:

> The system captures structured data during normal work, then turns it into
> management reporting without rebuilding a spreadsheet every week.

Ask:

- Which metrics go to leadership weekly or monthly?
- Do you measure cycle time from incident, intake, filing, acknowledgment, or
  payment?
- Which breakdowns drive action rather than just describe history?
- What should be scheduled by email versus explored on screen?

## Freight-claims terms you should know

- **Shipper/customer:** The party whose freight was transported or who is
  seeking reimbursement.
- **Carrier:** The company physically transporting the freight.
- **Broker:** The intermediary arranging transportation between shipper and
  carrier.
- **BOL (Bill of Lading):** Core shipment document describing the freight and
  transportation terms.
- **POD (Proof of Delivery):** Evidence of delivery, often noting visible
  shortage or damage.
- **PRO number:** Carrier tracking/reference number for a freight shipment.
- **Visible damage:** Damage noted at delivery.
- **Concealed damage:** Damage discovered after delivery and unpacking.
- **Shortage:** Part of the shipment is missing.
- **Claim exposure:** Amount currently being claimed; not necessarily the final
  amount paid.
- **Recovery:** Money recovered from a carrier, insurer, or another responsible
  party.
- **Acknowledgment:** Confirmation that the carrier received the formal claim.
- **Do-not-pay/payment hold:** A risk control that pauses carrier payment while
  an issue is reviewed.
- **MC/DOT/SCAC:** Common carrier identifiers used to distinguish companies with
  similar names.

## Presenter rules

- Lead with business outcomes, not menus.
- Tell one claim story from intake to reporting.
- Explain the difference between workflow status and filing status.
- Never present mock integration data as live carrier data.
- Avoid promising legal deadlines or compliance rules; ask the claims team to
  define their policy.
- If a feature is incomplete, say what works today, what is mocked, and what
  input is needed to finish it.
- Pause after each major page and ask one question. A good demo is a discovery
  conversation, not a race through every button.

## Strong closing

> We have shown a single source of truth from intake through carrier follow-up,
> documents, payments, holds, and reporting. The next step is to confirm your
> required fields, stage definitions, approval rules, and leadership metrics,
> then configure the workflow around those decisions.

Close with:

- What would prevent your team from using this every day?
- Which part would save the most time immediately?
- What must be changed before a pilot?
- Who should own the workflow decisions and acceptance testing?

