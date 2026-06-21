# Nts Knowledgebase V1

## NTS Knowledgebase v1.0 — for Custom GPT & Internal Agent

*Last updated: Aug 20, 2025* Purpose: Provide a single, exhaustive reference to teach a Custom GPT/Agent how NTS operates across brands, people, policies, workflows, tone, and data. Designed for retrieval and exact-answer responses. ---

## 0\) Quick Facts & Canonical Answers (Short Replies)

* **Company:** Nationwide Transport Services, LLC (NTS) * **Industry:** Full‑service logistics for heavy equipment, oversize/superload, containers, vehicles, freight, boats, and LTL. * **Team size:** 130+ logistics experts (brokers, marketers, account executives, operations). * **Core brands:** HeavyHaulers.com (HH), HeavyEquipmentTransport.com (HET), ContainerTransport.com (CT), TractorTransport.com (TT), NTSLogistics.com (NTS), AutoTransport.com (AT); also WideloadShipping.com (WLS). * **Experience:** 16+ years in transport; 23,000+ carriers in network (notably referenced for HET). * **Primary promise:** Expert, end‑to‑end transport with a single Account Executive (AE) assigned through the entire client experience. * **Primary channels:** Phone, email, SMS (transactional first), website forms; AI-assisted portal (VORTX) for internal productivity. * **CTA standard (all brands):** Invite the client to share pickup/delivery ZIPs, dimensions/weight, time frame, and special requirements. End all communications with a clear next step. ---

## 1\) Brands & Positioning

## 1.1 HeavyHaulers.com (HH)

* **Audience:** Heavy equipment owners, contractors, dealers; also trucks, freight, miscellaneous heavy loads. * **Voice:** Industrial, expert-level, seasoned; emphasizes the most experienced brokers \+ vast support team. * **Presentation:** May include tables or formatted data; brand-forward, professional; allows some marketing tone. * **Key claim:** High expertise with complex/heavy moves; coordinated team approach.

## 1.2 HeavyEquipmentTransport.com (HET)

* **HQ / Base:** Port St. Lucie, FL (brand identity context). * **Stats to cite:** 130+ logistics experts; 16+ years; 23,000+ carriers. * **Scope:** Heavy, oversize, superload; containers; pilot cars; permits; paperwork handling; international services. * **Voice:** Professional, logistics-driven, authoritative—but with direct human outreach (more personalized than HH). Structured and expert. * **Email tone:** Like communication from a high-level logistics platform; expert yet personable.

## 1.3 ContainerTransport.com (CT)

* **Focus:** Container-only logistics, state-to-state within U.S.; positioned as the \#1 hub for container moves. * **Voice:** Direct, efficient, authoritative; systematic/transactional tone—like a ticketing system. * **Presentation:** Structured, terse replies; clear fields; rapid next steps.

## 1.4 TractorTransport.com (TT)

* **Audience:** Farmers, equipment dealers. * **Voice:** Warm, relationship-based, one-to-one, farmer-friendly; highly conversational and personal. * **Presentation:** Plain-text style; appears from a representative; **no tables/HTML**.

## 1.5 NTSLogistics.com (NTS)

* **Scope:** Parent company/main brand; national scale, experience, credibility. * **Voice:** Professional and brand-heavy; showcases company presence and reasons to choose NTS.

## 1.6 AutoTransport.com (AT)

* **Scope:** Consumer & dealer vehicle transport; open/enclosed carriers; nationwide. * **Voice:** Clear and reassuring; consumer-friendly while expert.

## 1.7 WideloadShipping.com (WLS)

* **Scope:** Oversize, permits, pilot cars, route surveys; superloads. * **Voice:** Technical, confident, regulation-aware; emphasizes compliance and planning.

## *1.8 Brand Voice JSON (for retrieval)*

{ "HH": { "name": "HeavyHaulers.com", "tone": ["industrial", "expert", "brand-forward"], "formatting": {"tables\_allowed": **true**, "html\_allowed": **true**}, "cta": "Share pickup/delivery ZIPs, dimensions/weight, and timeframe to quote." }, "HET": { "name": "HeavyEquipmentTransport.com", "tone": ["professional", "structured", "personalized"], "claims": ["130+ logistics experts", "16+ years", "23,000+ carriers"], "cta": "Send specs and target window; we’ll coordinate routes, permits, and pilot cars." }, "CT": { "name": "ContainerTransport.com", "tone": ["direct", "efficient", "systematic"], "formatting": {"tables\_allowed": **true**, "html\_allowed": **true**}, "cta": "Provide container size/type, pickup/delivery ZIPs, and ready date to assign a dispatcher." }, "TT": { "name": "TractorTransport.com", "tone": ["warm", "personal", "relationship-based"], "formatting": {"tables\_allowed": **false**, "html\_allowed": **false**}, "cta": "Tell me the tractor model, dimensions, and timing—I'll get you options today." }, "NTS": { "name": "NTSLogistics.com", "tone": ["brand-heavy", "national-scale", "credible"], "cta": "Let’s scope your move and assign the right AE for start-to-finish handling." }, "AT": { "name": "AutoTransport.com", "tone": ["clear", "consumer-friendly", "expert"], "cta": "Share year/make/model, running condition, and dates for open/enclosed options." }, "WLS": { "name": "WideloadShipping.com", "tone": ["technical", "confident", "compliance-first"], "cta": "Send load dims/weight and route—our team will handle permits, pilot cars, and surveys." } } ---

## 2\) People & Roles (Directory for Personalization)

Use this to personalize replies, route internally, and maintain context/history. * **Julian Foltz** — CIO (lead on CRM/BI, AI, SEO/SEM strategy, operations modernization, brand voice frameworks, dispatch queue). * **Jason Foltz** — Co‑owner. * **Francisca Olive Kaigi** — SEO & SEM Strategist (Dec 2024 on-site; contract in 2025; leads SEO/SEM plans; content structure reviews, esp. CT; 2025 planning with marketing/dev). * **Javier** — Reference contract structure for new SEO strategist contract. * **Don Foltz** — Retired (announced 2025-11-01 context). * **Joao (dev)** — Historical issue with form/lead notifications (Oct 2024); escalations managed by **Lucas (PM)**.

## *Role Labels Used in CRM & Operations*

* **Broker / Account Executive (AE):** Primary client-facing owner of a lead/order. (Historically “Assigned User”.) * **Sales (New Role):** Prospecting/expansion; can share commission in certain account structures. * **Dispatcher (New Role):** Operational assignment, posting, dispatch, tracking; must see all orders assigned to them across multiple brokers. ---

## 3\) Services & Capabilities

* **Heavy Equipment Transport**: Dozers, excavators, cranes, agricultural equipment, trucks. * **Oversize & Superload**: Route planning, permits, pilot cars/escorts, route surveys, traffic control coordination. * **Container Transport**: Power-only, chassis, drayage coordination; rotator/crane placement; residential logistics when feasible. * **Freight & LTL**: Standard LTL portal system under development (self-serve rate/shop/book) * **Auto Transport**: Open/enclosed carriers; dealer & consumer. * **Boats & Specialty**: Arranged as part of network capacity. * **International & Paperwork**: Cross-border requirements, customs documentation (HET brand highlights international solutions).

## *Required Specs (ask every time)*

* Pickup/delivery **ZIP codes**; **ready date**; load **dimensions** (L×W×H); **weight**; running condition (if vehicle); special handling (e.g., cranes/rotators, tarping); site restrictions. ---

## 4\) Policies, Promises & Comms Standards

* **Single AE Ownership:** One Account Executive remains assigned throughout the experience. * **SMS Use:** Primarily **transactional** (driver assignments/whereabouts, status updates). Marketing only as reply to prior outreach. * **Email CTA:** Every email ends with a clear call to action (request missing specs, propose a call, or confirm booking). * **Branding in Subject:** Add brand tag or name to subject lines to differentiate. * **Response Quality:** Expert, concise, confident. Avoid fluff; match brand voice. Never promise guaranteed pickup/delivery windows beyond industry norms. * **Regulatory Compliance:** For oversize/superloads, emphasize permit and escort requirements; never advise skipping legal steps. * **Damage & Accessory Policy:** Accessories purchased by client (e.g., **castors** for containers) are client responsibility unless contracted; recommend proper equipment (crane/rotator) for placement. ---

## 5\) Sales Process & Lead Management

## 5.1 Lead Intake & Assignment

* Sources: brand websites, phone, email parsing, referrals. * AE is assigned on intake; AE owns follow-through. * Consistency: Top performers log into queues **9am–5pm** daily; exclusive leads prioritized; queue engagement tracked.

## 5.2 Follow-Up Cadence (High-Level)

1. **Immediate response** (minutes): Acknowledge, confirm specs needed; propose times; SMS transactional if appropriate. 2. **Day 1–3:** Alternate email/phone/SMS; provide options with transparent pricing anchors, not hard promises; overcome objections. 3. **Day 4–10:** Value-add touchpoints (permit path, route timing, capacity windows); reduce friction to book. 4. **30+ days:** Long-tail nurture if still relevant.

## 5.3 AI Sales Coach (Internal)

* Helps prospect, draft scripts, handle objections, and build follow-up plans. * Video guide includes examples on past customer outreach and new business workflows.

## 5.4 Objections (Logistics Examples)

* **“Price is too high.”** → Clarify specs, offer timing/route/capacity options; explain quality/safety value; seek flexible dates. * **“Another carrier is cheaper.”** → Explain carrier vetting, insurance, on-time reliability, and risk of underbids. * **“Timing is uncertain.”** → Propose targeted windows; explain permit constraints and realistic ETAs. * **“I’ll move it myself.”** → Educate on permits, escorts, liability; outline total cost and risk. ---

## 6\) Dispatch Queue & Operations Workflows

## 6.1 Phase 1 (Completed)

* New POD-model dispatch queue established. * Click-to-Call enabled in CRM. * Email notifications for assignment and reassignment. * History log display bug fixed; search field options enhanced.

## 6.2 Phase 2 (Targets)

* **Dispatcher Assignment Role:** Orders can be assigned to a **Dispatcher** by anyone. Dispatcher sees all assigned orders across multiple brokers. * **Visibility:** Dispatcher views orders by lifecycle columns (Queue, Posted, Dispatched, Payment Due, Delivered, Archived). * **Notifications:** Email on **assign** and **unassign** to dispatcher. * **Reporting:** Dispatcher workload & SLA tracking.

## 6.3 Core Ops Standards

* Post to vetted boards when needed; verify insurance and MC status; document dispatch details. * Use pilot cars, permits, and route surveys per jurisdiction; no shortcuts. * Communicate driver location and milestones via transactional SMS/email. ---

## 7\) CRM Data Model & Key Features

## 7.1 Lead/Order Data Evolution

* Replace generic Year/Make/Model with **load-specific fields** per transport type (freight dims, container details, vehicle condition, etc.). * Correct data routing into CRM from brand forms (historical issues corrected; ongoing QA process in place).

## 7.2 Additional Charges (Pricing Information)

* Up to **10 itemized charges** with amount \+ description (≤150 chars each). * **E‑signature**: “Itemized Client Contract – E‑Signature.” * Not part of tariff calc; generates separate client e-signature doc. * Example items: Insurance, Demurrage, Tarping, Loading, Tires, Route Survey, Oversize Permits, Pilot Car Escort.

## 7.3 Notifications & Features (Examples/Status)

* **Bug Fixed:** Scheduled Task Notifications; Central Dispatch Posting; History log display; Carrier return email routing. * **Updates:** Exact Load Times on BOL; Search fields enhanced; Expected Delivered Order restrictions; Terminal Database Directory access restricted. * **New Features:** User Engagement Report; Click-to-Call in CRM; Report updates for Client Aging & Carrier Pay Pending.

## 7.4 Queue Engagement & KPIs

* **Queue Engagement Metric:** Daily log-in adherence, time in queue, touch frequency. * **Sales Benchmarks:** Progression thresholds into “Up & Coming” and “Heavy Haulers” groups. ---

## 8\) BI, Reporting & Dashboards

* Daily parsing failure reports (success/failure counts; attachment with logs); action item loop to fix. * Brand- and source-level lead tracking; value trends; conversion. * Broker performance: revenue, margin, conversion, follow-up cadences, AE workload. * Dispatch SLAs: post-to-pickup time, permit-processing lead time, delivery ETA accuracy. ---

## 9\) Marketing, SEO & PPC

## 9.1 SEO Operations

* **Writers** must propose all content/site plan monthly; no unapproved writing. Invoice with **cost/word**, **word count**, and **article link**; 30‑day net pay. * **Content Architecture:** City/State landing pages; industry-specific service pages; update cadence to maintain rankings. * **Design System:** Assets from secured 99designs creatives; reuse planned sections (esp. HET) when appropriate. * **ContainerTransport.com:** Dedicated content structure and 2025 objectives; deep dive in December meetings. * **Partner Strategy:** “Bridging Distances” in Canada; send Canadian client leads; contract CRM/TMS version; build SEO/SEM for Canadian audiences. * **Rank Tracking:** Use external tools (e.g., SEOTesting.com) as discussed; monitor AI-driven search impact.

## 9.2 PPC

* Campaigns segmented by: “Equipment Transport,” “Construction Equipment Transport,” and “Moving/Logistics/Freight (Heavy Equipment).” * **Ad group ideation:** Heavy hauling (remove non-heavy equipment terms); container moves; oversize permits; pilot cars; route surveys; superload logistics; auto transport open/enclosed; agricultural equipment.

## 9.3 Email Signatures & UTMs (Template)

https://\<brand-domain\>/?utm\_source=email\_signature\&utm\_medium=ae\&utm\_campaign=brand\_presence\&utm\_content=\<rep\_name\> * Replace plain website URLs with UTMs in CRM signature blocks. ---

## 10\) Communication Libraries

## 10.1 Brand Style Rules (All Emails)

* End with a **CTA** and at least one **question** to advance the deal. * Keep **reading level** practical/clear. Avoid fluff. * **Subject** includes brand name/identifier.

## 10.2 ContainerTransport (Transactional-Ticket Style Snippet)

Subject: [CT] Container Move – Next Step Needed Ticket \#: \<auto\> Container: \<size/type\> Pickup: \<ZIP / Facility\> Delivery: \<ZIP / Facility\> Ready: \<date\> Notes: \< crane/rotator | site limits \> Action needed: Please confirm the above and share any gate or appointment requirements.

## 10.3 TractorTransport (Warm 1:1 Snippet)

Subject: Tractor Move – quick questions to quote Thanks for reaching out. To get you the best options today, can you share: • Tractor model (and implements, if any) • Dimensions (L×W×H) and weight (rough estimate is okay) • Pickup & delivery ZIPs • Target timing Would you like me to give you a quick call this afternoon, or reply here?

## 10.4 HeavyHaulers (Expert Table Snippet)

Subject: Heavy Haul Plan – options & timelines | Item | Details | |---|---| | Load | \<equipment/type\> | | Size/Weight | \<L×W×H / lbs\> | | Route Window | \<dates\> | | Permits/Escorts | \<required/optional\> | | Site Constraints | \<notes\> | Next steps: confirm specs or send drawings/photos. Want a 10‑min call to lock in timing?

## 10.5 HET “No Contact After Estimate” Snippet (Personalized, Professional)

Subject: HET – Following up on your shipping estimate I put together a route and timing window that fits your move. If your dates or specs changed, I’ll rework the plan today. Would you like a quick call to finalize, or should I send dispatch-ready paperwork? — \<AE Name\>

## 10.6 Hold Message Voiceover Ideas (Rotating)

* “You’ve reached Nationwide Transport Services. From permits to pilot cars, our specialists plan every detail so your load arrives safely.” * “Ask about our dedicated Account Executive model—one point of contact from quote to delivery.” * “Moving a container? We coordinate cranes or rotators for precise placement when needed.” ---

## 11\) Meetings & Tools

## 11.1 GoTo Meeting – Permanent Room Link

* Each user has a permanent “meeting room” link: https://meet.goto.com/\<firstnameLastname\> (example: https://meet.goto.com/julianfoltz). * Find your room and create reusable meetings via the **GoTo desktop app** or **browser app.goto.com**. * Internal SOP includes two help videos: * *GoTo Meeting In‑session Quick Start.* * *How do I create a reusable meeting and use rooms in GoTo with the desktop app?*

## 11.2 Telephony Migration Notes

* Migration from **Vonage** to **GoTo** documented by function & how‑to guides. ---

## 12\) Customer Policies & Legal Language

## 12.1 Taxes Clause (Explained Simply)

* Price excludes sales/use/VAT taxes on the sale; those taxes are for the buyer’s account unless a valid exemption is provided. * If NTS is registered to collect, taxes are added to the price. * All other taxes imposed on NTS (not on the sale) are NTS’s responsibility.

## 12.2 Accessory Responsibility (Container Castors Example)

* Accessories purchased/installed by the client are not NTS’s responsibility unless explicitly contracted. Recommend crane/rotator services for placement.

## 12.3 AE Promise (Clarity)

* A single AE per client experience; internal dispatch/ops may involve multiple specialists, but client-facing ownership stays with the AE. ---

## 13\) Training Modules Index

1. **Lead Intake to Assignment** — capturing specs; tagging; AE handoff. 2. **Objections & Value Story** — margins, compliance, insurance. 3. **Permits & Escorts 101** — when required; lead times; typical state nuances. 4. **Container Moves** — power-only vs chassis vs dray; cranes/rotators; residential constraints. 5. **Dispatch Queue Mastery** — role assignment, notifications, columns, SLAs. 6. **CRM Data Entry** — load-specific fields; common errors; additional charges & e-sign. 7. **Status Comms** — SMS transactional policy; milestone updates. 8. **HET vs HH vs CT vs TT vs AT vs WLS** — tone, structure, and examples. 9. **PPC & SEO Fundamentals** — landing page alignment; keyword to brand alignment. 10. **AI Tools (VORTX)** — Proposal/Doc Builder; Contract Editor; KPI Coach; Sales Coach. ---

## 14\) VORTX (AI Portal) — What’s Inside

* **Proposal & Document Builder:** Create client-ready docs in minutes. * **Contract Editor:** Refine agreements with clarity/consistency. * **KPI Automation Coach:** Turn results into action items weekly. * **Sales Coach:** Scripts, objections, follow-up sequences by lead. * **24/7 Transport Support AI:** Explains permits, escorts, oversize regs, and complex shipments step-by-step. ---

## 15\) SMS Guidelines

* Primarily **transactional**: responses to shipping requests; driver/load whereabouts; status updates. * Limited marketing: generally only in response to prior client outreach. * Maintain opt-in/opt-out compliance per brand. ---

## 16\) Pricing & Margin Notes (Internal)

* Example commission share: Sales role can receive **5%** from broker’s share when accounts are shared, with math assessed on total profit. * ROI bar for Sales role salary example: If paid $40k/year and company target margin \~60%, then newly acquired business of \~$66,667/year covers salary; above that drives profit. ---

## 17\) Forms, QA & Data Integrity

* Past issues: certain brand forms did not index into CRM; corrective action added: QA for forms, email notifications, indexing verification. * Launch process: standardized checks for new forms; minimize redundant forms. * Indexing: map to **SendGrid** contact lists and outreach tools by source. ---

## 18\) Knowledgebase & Help Center Content Strategy

* Users may ask for “Zoom link” etc.—surface GoTo **permanent meeting** feature and instructions. * Tag content with synonyms and intents for searchability (e.g., “conference link,” “video call,” “meeting room,” “Teams/Zoom alternative”). * Announcements avoid unnecessary thanks; keep concise and direct. ---

## 19\) Safety, Limits & Escalations for the Agent

* **Do not** give legal/tax guarantees; provide general guidance then escalate to AE/Compliance. * **Do not** promise exact pickup/delivery dates; offer windows and explain dependencies (permits/capacity). * **Do not** share internal personal data externally; confirm identity before account‑specific details. * **Escalate** urgent service failures, safety issues, or damage claims to AE/Ops Manager immediately. ---

## 20\) FAQ (Client-Facing)

* **What info do you need to quote?** ZIPs, dimensions, weight, timing, special handling. One AE manages the process end‑to‑end. * **Are permits/pilot cars included?** We confirm requirements per route and include in planning/quote as needed. * **Can you place a container on site?** Yes—with proper equipment (crane/rotator). We’ll coordinate when requested. * **Do you ship non-running vehicles?** Yes; please note condition for proper equipment. ---

## 21\) Glossary

* **AE (Account Executive):** Primary client owner. * **POD-Model Dispatch Queue:** Operational board with lifecycle columns and role assignment. * **Pilot Car/Escort:** Safety vehicle required for certain oversize moves. * **Route Survey:** Pre-run check of route clearances/constraints. ---

## 22\) Structured Data Blocks (for Retrieval-Augmented Generation)

## 22.1 CRM Roles (Enum)

{"roles": ["Broker(AE)", "Sales", "Dispatcher"]}

## 22.2 Required Specs Schema

{ "quote\_requirements": [ "pickup\_zip", "delivery\_zip", "ready\_date", "dimensions\_lwh", "weight\_lbs", "running\_condition", "special\_handling" ] }

## 22.3 Brand Subject Prefixes

{"subject\_prefix": {"HH":"[HH] ", "HET":"[HET] ", "CT":"[CT] ", "TT":"[TT] ", "NTS":"[NTS] ", "AT":"[AT] ", "WLS":"[WLS] "}}

## 22.4 UTM Signature Template

{ "utm\_signature": "https://\<brand-domain\>/?utm\_source=email\_signature\&utm\_medium=ae\&utm\_campaign=brand\_presence\&utm\_content=\<rep\_name\>" } ---

## 23\) Roadmap / TODO (Fill as info becomes available)

* Add HQ addresses and office hours per brand (public-facing). * Add state-by-state permit lead time cheat sheet. * Add AE roster with photos and bios (internal-only). * Add LTL portal user guide with screenshots. * Add formal SLA targets by product line. ---

## 24\) Change Log

* **2025‑08‑20:** v1.0 initial comprehensive build for Custom GPT training.
