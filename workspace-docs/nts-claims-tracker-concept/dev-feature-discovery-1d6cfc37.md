## Meeting Context

```json
{
  "attendees": [
    {
      "name_or_role": "George Feiss",
      "function": "Claims Staff / Broker"
    },
    {
      "name_or_role": "Karen",
      "function": "Claims Staff / Broker"
    },
    {
      "name_or_role": "Christina Daly-Fazio",
      "function": "Claims Staff / Broker"
    },
    {
      "name_or_role": "Noah M.",
      "function": "Product Engineer"
    }
  ],
  "current_app": "FreightClaims (primary claims system), Spreadsheets, CRM (SalesTrack module), Memos, Tasks, Comments",
  "stage_of_replacement": "Foundation built, gathering requirements before feature work for claims management module within existing CRM boilerplate.",
  "duration_minutes": 19
}
```

## Personas

- **Role:** Claims Staff / Broker · **Primary Goals:** Efficiently track cargo and transportation claims from intake to closure., Consolidate all claim-related information into a single system., Generate accurate and detailed reports for management based on various criteria (office, broker, cargo type, payment source)., Reduce manual data entry and duplication across multiple tools. · **Top Frustrations:** Data scattered across 6+ systems., Inability to generate custom reports from the current claims system., Lack of visibility for management and payables into claim status., Clunky transaction logging for claim payments. · **Success Looks Like:** All claim data, notes, tasks, and documents are in one central application; management can self-serve reports; claims are processed and closed efficiently with clear financial tracking.
- **Role:** Management / Payables · **Primary Goals:** Gain clear visibility into the status and financial impact of all claims., Access comprehensive reports on claims performance by office, broker, and cargo type., Understand payment responsibilities (who paid what) for closed claims. · **Top Frustrations:** Reliance on claims staff for status updates., Lack of detailed reporting to inform strategic decisions (e.g., pricing adjustments). · **Success Looks Like:** Easy access to real-time claim status and detailed, filterable reports without interrupting claims staff.

## Pain Points

- **Id:** P1 · **Description:** Claims data and related information are scattered across at least six different systems (tasks, comments, memos, CRM, spreadsheet, FreightClaims), leading to significant manual duplication and difficulty in getting a complete picture. · **Severity:** 5 · **Frequency:** daily · **Affected Roles:** Claims Staff / Broker, Management / Payables · **Quote:** right now we literally have like six spots we have to record everything between tasks, comments, memos, CRM, spreadsheet, you know, all those kind of things. And it's, it makes it difficult. · **Timestamp:** 00:36
- **Id:** P2 · **Description:** The current FreightClaims software fails to provide promised and necessary reports for management. The existing reports are described as 'irrelevant' and 'useless,' forcing manual workarounds for insights. · **Severity:** 5 · **Frequency:** monthly · **Affected Roles:** Claims Staff / Broker, Management / Payables · **Quote:** free claims is not necessarily a bad software package. It's just, it keeps promising us reports and it has not been providing those reports. [...] the biggest issue is the reports. We can't get any reports. [...] Whenever we pull it, it's a mass, nothing, uselessness. · **Timestamp:** 00:30
- **Id:** P3 · **Description:** Management and payables staff cannot easily access the status of a claim without directly contacting the claims team, leading to frequent interruptions and delays. · **Severity:** 4 · **Frequency:** daily · **Affected Roles:** Management / Payables, Claims Staff / Broker · **Quote:** the only way for them to find out the status of a claim is to call us or email. · **Timestamp:** 00:49
- **Id:** P4 · **Description:** Inability to run reports filtered by specific criteria like office location, sales rep (broker), or cargo type, which hinders strategic decision-making and pricing adjustments. · **Severity:** 4 · **Frequency:** monthly · **Affected Roles:** Claims Staff / Broker, Management / Payables · **Quote:** we'll be able to run reports by company, by, by office location and by sales rep. And, and also the possibility, if, if it's there, maybe even run the report by product, like, you know, buses or RVs or, you know, whatever the particular cargo type is · **Timestamp:** 02:18
- **Id:** P5 · **Description:** The process of logging transactions when closing a claim is clunky and makes it difficult to accurately mark who paid (carrier, insurance, NTS, broker) for financial tracking and reporting. · **Severity:** 3 · **Frequency:** daily · **Affected Roles:** Claims Staff / Broker · **Quote:** when we, when we log the transaction, we want to be able to mark whether carrier paid it, the insurance company paid it, nationwide paid it, the broker paid it. So, you know, we can run reports on a monthly basis · **Timestamp:** 07:33
- **Id:** P6 · **Description:** Security concerns regarding accidental data loss or deletion if all users have unrestricted access to add notes or modify claims. · **Severity:** 3 · **Frequency:** rare · **Affected Roles:** Claims Staff / Broker, Management / Payables · **Quote:** I don't want everybody having access to this right. This can't be, this can't be where anybody can just click on it and go add a note or something like that. We can't have that because things get lost, accidentally things get deleted. · **Timestamp:** 00:54

## Latent Needs

- **Id:** L1 · **Observation:** Users currently duplicate notes across multiple systems (CRM, spreadsheet, FreightClaims) for a single claim. · **Suggested Feature:** A central activity log or note-taking feature within the Claims Tracker that automatically associates notes with the specific claim and, ideally, syncs relevant information to other integrated systems. · **Evidence Quote:** Right now, we're putting a note in the CRM, we're putting a note on the spreadsheet, we're putting a note on freight claims. If we put a note in the CRM, is there a way for that note to automatically go into that order, into our claims section? · **Timestamp:** 08:30 · **Confidence:** high
- **Id:** L2 · **Observation:** Users explicitly state the need for a dedicated section on each claim page to add notes and log correspondence (calls, emails). · **Suggested Feature:** A 'Contact Log' or 'Activity Log' component on each claim detail page, allowing quick entry of notes, call logs, and email records, similar to the SalesTrack demo shown. · **Evidence Quote:** for each claim, we need a section that, like, that's got, when you click on that claim, that you're able to add notes to that particular claim right there. · **Timestamp:** 16:18 · **Confidence:** high
- **Id:** L3 · **Observation:** Users are concerned about the manual effort required to transfer existing claims data from their old system (FreightClaims) to the new one. · **Suggested Feature:** A data migration tool or service to import historical claims data from FreightClaims into the NTS Claims Tracker, minimizing manual re-entry. · **Evidence Quote:** Are you, are we, you guys, able to pull all of our claims out of freight claims? Or do we have to come back to our freight claim, our CRM and put them in manually? · **Timestamp:** 09:07 · **Confidence:** high
- **Id:** L4 · **Observation:** Users express concern about unauthorized or accidental modifications to claim data due to open access. · **Suggested Feature:** Granular Role-Based Access Control (RBAC) to define specific permissions for viewing, adding, editing, and deleting different types of claim data (e.g., notes, transactions) based on user roles. · **Evidence Quote:** This can't be, this can't be where anybody can just click on it and go add a note or something like that. We can't have that because things get lost, accidentally things get deleted. · **Timestamp:** 00:54 · **Confidence:** high

## Workflows

- **Intake a New Claim**
  - _Actor:_ Claims Staff / Broker
  - _Trigger:_ A new freight damage, loss, or service failure is reported by a customer or internal team.
  - _Frequency Per Week:_ 
  - _Steps:_ {"step":"Receive claim information (e.g., via phone, email, public web form).","current_tool":"Phone / Email / Public Form (NTS Claims Tracker intake form)","friction_level":"low","time_estimate":null}, {"step":"Enter initial claim details into FreightClaims.","current_tool":"FreightClaims","friction_level":"medium","time_estimate":"5-10 min"}, {"step":"Record notes related to the claim in the CRM (SalesTrack).","current_tool":"CRM","friction_level":"medium","time_estimate":"2-3 min"}, {"step":"Record notes in a separate spreadsheet for tracking.","current_tool":"Spreadsheet","friction_level":"medium","time_estimate":"2-3 min"}, {"step":"Record notes in a memos system.","current_tool":"Memos","friction_level":"medium","time_estimate":"2-3 min"}, {"step":"Create and track tasks related to the claim.","current_tool":"Tasks","friction_level":"medium","time_estimate":"2-3 min"}
  - _Biggest Friction:_ Duplicative data entry across multiple disparate systems for a single claim, leading to inefficiency and potential inconsistencies.
- **Track Claim Status & Progress**
  - _Actor:_ Claims Staff / Broker
  - _Trigger:_ A need to update or check on a claim, or a request from management/payables for status.
  - _Frequency Per Week:_ 5
  - _Steps:_ {"step":"Access FreightClaims to view the primary claim details.","current_tool":"FreightClaims","friction_level":"low","time_estimate":"1-2 min"}, {"step":"Check CRM (SalesTrack) for related customer notes or interactions.","current_tool":"CRM","friction_level":"low","time_estimate":"1-2 min"}, {"step":"Consult a separate spreadsheet for additional tracking or specific details.","current_tool":"Spreadsheet","friction_level":"low","time_estimate":"1-2 min"}, {"step":"If management or payables requests status, manually gather information and communicate it.","current_tool":"Phone / Email","friction_level":"high","time_estimate":"5-15 min"}
  - _Biggest Friction:_ Management and payables cannot self-serve claim status, leading to frequent interruptions for claims staff and delayed information flow.
- **Close a Claim & Log Payment**
  - _Actor:_ Claims Staff / Broker
  - _Trigger:_ A claim has been resolved and payment has been received or issued.
  - _Frequency Per Week:_ 
  - _Steps:_ {"step":"Navigate to the specific claim in FreightClaims.","current_tool":"FreightClaims","friction_level":"low","time_estimate":"1 min"}, {"step":"Initiate the 'Log Transaction' process.","current_tool":"FreightClaims","friction_level":"medium","time_estimate":"1-2 min"}, {"step":"Select a 'Transaction Type' (e.g., Inbound Payment, Outbound Payment).","current_tool":"FreightClaims","friction_level":"low","time_estimate":"30 sec"}, {"step":"Attempt to select a 'Transaction Code' (often problematic or unclear).","current_tool":"FreightClaims","friction_level":"high","time_estimate":"1-3 min"}, {"step":"Manually determine and record the party responsible for the payment (Carrier, Insurance, NTS, Broker).","current_tool":"FreightClaims","friction_level":"medium","time_estimate":"1-2 min"}
  - _Biggest Friction:_ The transaction logging interface is clunky, and accurately categorizing payment sources for reporting is difficult, leading to potential financial tracking issues.

## Must Keep

- **Feature Or Behavior:** Claim Assignment to Specific Staff · **Why It Matters:** Ensures clear ownership and accountability for each claim, allowing for efficient workload distribution and tracking. · **Evidence Quote:** You guys are assigning the claims, right? So, is this the entire claims team right here? Yep, that's it. Also, you guys, you do, like, you assign to Christina, are some claims assigned to you, Karen? Yeah, some are to me, some are to George, some are Christina, just depending on what's going on. But yes.
- **Feature Or Behavior:** Basic Claim Information Display (Claim ID, Assigned To, Filed Amount, Last Updated) · **Why It Matters:** Provides essential context and key details about a claim at a glance, which is crucial for quick understanding and navigation. · **Evidence Quote:** Claim 1055712 Assigned to: George Feiss Claim Age: 0 days Last Updated: 7/12/2026 Filed Amount: $1,000.00

## Terminology

- **Their Word:** Claim · **Common Synonym:** Case / Ticket / Incident · **Definition:** A formal request for compensation for freight damage, loss, or service failure. · **Use In Ui:** Claim ID, File a Claim, Claim Status, My Claims
- **Their Word:** Broker · **Common Synonym:** Sales Rep / Agent / Team Member · **Definition:** An individual responsible for managing customer relationships and claims. · **Use In Ui:** Assigned Broker, Broker Reports, Team Member Profile
- **Their Word:** Office Location · **Common Synonym:** Branch / Region · **Definition:** The physical office where a broker or claims staff is based. · **Use In Ui:** Office Filter, Office Performance, Team Member Office
- **Their Word:** Cargo Type · **Common Synonym:** Product Type / Commodity · **Definition:** The specific type of goods being transported (e.g., buses, RVs). · **Use In Ui:** Filter by Cargo Type, Cargo Type Analysis, Freight Type
- **Their Word:** Transaction · **Common Synonym:** Payment / Financial Event · **Definition:** A record of money paid or received related to a claim. · **Use In Ui:** Log Transaction, Transaction History, Claim Transactions
- **Their Word:** Transaction Type · **Common Synonym:** Payment Category · **Definition:** Classification of a financial transaction (e.g., Inbound Payment, Outbound Payment). · **Use In Ui:** Transaction Type dropdown
- **Their Word:** Transaction Code · **Common Synonym:** GL Code / Sub-category · **Definition:** A specific code associated with a transaction type for detailed accounting. · **Use In Ui:** Transaction Code dropdown
- **Their Word:** FreightClaims · **Common Synonym:** Legacy Claims System · **Definition:** The existing third-party software currently used for claims management. · **Use In Ui:** (Internal reference only, not in user-facing UI)
- **Their Word:** CRM · **Common Synonym:** Sales Tracker / Customer Relationship Management · **Definition:** The new application being developed/augmented, intended to consolidate claims and customer data. · **Use In Ui:** NTS Claims Tracker (product name)

## Integrations Mentioned

- **System:** FreightClaims · **Purpose:** Current claims management system, source of historical data. · **Direction:** inbound · **Priority:** must_have
- **System:** CRM (NTS Claims Tracker / SalesTrack) · **Purpose:** The new consolidated platform for claims and customer management. · **Direction:** both · **Priority:** must_have
- **System:** MCP (My Carrier Portal) · **Purpose:** Potential integration for carrier-related claims information or updates. · **Direction:** outbound · **Priority:** nice_to_have
- **System:** Central Dispatch · **Purpose:** Dispatching system, likely a source of order information relevant to claims. · **Direction:** both · **Priority:** must_have

## Metrics They Care About

- **Metric:** Claim Count · **Currently Tracked:** true · **Why It Matters:** Basic volume metric for workload and overall claim activity.
- **Metric:** Average Claim Age · **Currently Tracked:** true · **Why It Matters:** Indicates the efficiency and speed of claims processing.
- **Metric:** Total Claim Amount · **Currently Tracked:** true · **Why It Matters:** Measures the total financial impact of claims.
- **Metric:** Claims by Office Location · **Currently Tracked:** false · **Why It Matters:** Enables performance comparison between offices and informs resource allocation.
- **Metric:** Claims by Broker / Sales Rep · **Currently Tracked:** false · **Why It Matters:** Tracks individual performance, identifies training needs, and supports coaching.
- **Metric:** Claims by Cargo Type · **Currently Tracked:** false · **Why It Matters:** Helps identify high-risk cargo types to inform pricing strategies and risk management.
- **Metric:** Amounts Paid Out by Party (Carrier, Insurance, NTS, Broker) · **Currently Tracked:** false · **Why It Matters:** Provides clear financial accountability and cost analysis for each claim and overall.
- **Metric:** Closed Claims Count · **Currently Tracked:** false · **Why It Matters:** Measures productivity and the rate of claim resolution.
- **Metric:** Open Claims Count · **Currently Tracked:** false · **Why It Matters:** Indicates current workload and outstanding liabilities.

## Quick Wins

- **Feature:** Centralized Activity Log on Claim Page · **Effort:** S · **Expected Impact:** Immediately reduces manual duplication of notes across systems and provides a single source of truth for claim interactions, improving context for claims staff. · **Addresses:** P1, L1, L2
- **Feature:** Basic Reporting Filters (Office, Broker) · **Effort:** M · **Expected Impact:** Provides immediate, basic insights for management regarding team and office performance, addressing a key reporting gap without requiring complex analytics infrastructure. · **Addresses:** P4, P3
- **Feature:** Improved Transaction Logging for Payment Source · **Effort:** M · **Expected Impact:** Enhances data quality for financial reporting by clearly capturing who paid, reducing friction in the claim closure workflow and enabling better financial analysis. · **Addresses:** P5

## Recommended Backlog

- **Centralized Claims Data Model & UI**
  - _Type:_ ux
  - _Priority:_ P0
  - _Effort:_ L
  - _Value Hypothesis:_ Consolidating all claims-related information (notes, tasks, documents, transactions) into a single, intuitive interface will drastically reduce manual data entry, improve data accuracy, and streamline claims staff workflows.
  - _Acceptance Criteria:_ All claim details, associated tasks, notes, documents, and transaction logs are accessible from a single claim detail page., Adding a note or logging an activity automatically links it to the specific claim., Eliminates the need for claims staff to update multiple external systems for a single claim.
  - _Source Ids:_ P1, L1, L2
  - _Depends On:_ 
- **Comprehensive Reporting Dashboard**
  - _Type:_ feature
  - _Priority:_ P0
  - _Effort:_ L
  - _Value Hypothesis:_ Providing robust, filterable reports will enable management to make data-driven decisions, track team performance, and optimize pricing strategies, eliminating the need for manual data consolidation.
  - _Acceptance Criteria:_ Users can generate reports filtered by Office Location, Assigned Broker, Claim Status (Open/Closed), and Cargo Type., Reports include metrics like Claim Count, Average Claim Age, Total Claim Amount, and Amounts Paid Out by Party., Reports are exportable (e.g., CSV, PDF).
  - _Source Ids:_ P2, P3, P4, P5
  - _Depends On:_ Centralized Claims Data Model & UI, Improved Transaction Logging for Payment Source
- **Role-Based Access Control (RBAC) for Claims Data**
  - _Type:_ feature
  - _Priority:_ P1
  - _Effort:_ M
  - _Value Hypothesis:_ Implementing granular permissions will prevent accidental data loss or unauthorized modifications, ensuring data integrity and user confidence in the system.
  - _Acceptance Criteria:_ Admins can define roles (e.g., Claims Staff, Manager, Read-Only) with specific permissions for viewing, adding, editing, and deleting claim data., Users can only perform actions permitted by their assigned role., Accidental deletion or modification of critical data is prevented.
  - _Source Ids:_ P6, L4
  - _Depends On:_ Centralized Claims Data Model & UI
- **Historical Claims Data Migration from FreightClaims**
  - _Type:_ data
  - _Priority:_ P1
  - _Effort:_ L
  - _Value Hypothesis:_ Migrating existing claims data will provide a complete historical record within the new system, avoiding manual re-entry and enabling comprehensive historical reporting from day one.
  - _Acceptance Criteria:_ All active and closed claims from FreightClaims are successfully imported into the Claims Tracker., Key data fields (claim ID, amounts, dates, parties, status) are mapped correctly., Data integrity is maintained during migration.
  - _Source Ids:_ L3
  - _Depends On:_ Centralized Claims Data Model & UI
- **Integration with Central Dispatch**
  - _Type:_ integration
  - _Priority:_ P2
  - _Effort:_ L
  - _Value Hypothesis:_ Connecting with Central Dispatch will streamline the flow of order-related information into claims, reducing manual lookups and potential errors, and providing a more complete picture of each shipment.
  - _Acceptance Criteria:_ Claims can be linked to Central Dispatch order numbers., Relevant order details (e.g., carrier info, shipment details) are automatically pulled into the claim.
  - _Source Ids:_ 
  - _Depends On:_ Centralized Claims Data Model & UI

## Risky Assumptions

- **Assumption:** FreightClaims allows for a comprehensive export of all historical claims data in a structured, usable format (e.g., CSV, API). · **How To Validate:** Noah needs to obtain admin access to FreightClaims from George and investigate its export capabilities, including available data fields and format. This is critical for the 'Historical Claims Data Migration' backlog item.

## Open Questions

- **Question:** What are the exact fields and filters required for monthly/ad-hoc reports for management, beyond what was generally discussed? · **Ask Who:** George, Karen, Christina, Alex (management)
- **Question:** What is the estimated volume of historical claims that need to be migrated from FreightClaims? · **Ask Who:** George, Karen, Christina
- **Question:** What specific criteria define a 'high value' claim that might require different workflows or reporting? · **Ask Who:** George, Karen, Christina, Management
- **Question:** What are the specific interactions and data points needed for each 'claim party' (shipper, carrier, insurer, etc.) throughout the claim lifecycle? · **Ask Who:** George, Karen, Christina

## Next Action

Noah to obtain admin access to FreightClaims from George to investigate its data export capabilities and structure.