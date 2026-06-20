# GoTo Support Email Package - Ready to Send

## 📧 Email Draft
**File:** `GOTO-SUPPORT-EMAIL-DRAFT.md`

Copy the entire content (from "Subject:" to the end) into your email to GoTo support.

**Key points in the email:**
- ✅ Professional but firm tone
- ✅ Clarifies you're not asking for coding help - you need documentation verification
- ✅ References that they admitted docs are outdated months ago
- ✅ Provides all technical details they need
- ✅ Clear specific requests (2 distinct issues explained)
- ✅ Shows you're a paying customer with working integrations (not a random dev)

---

## 📎 Attachments to Include

### 1. debug-token-response.json
**Location:** `goto-support-attachments/debug-token-response.json`

**What it shows:**
- All OAuth scopes successfully granted (proves authentication works)
- All 5 queue-caller endpoint variations returning 404
- SCIM API returning 401 
- Your admin user has `orgAdmin: false` (likely why SCIM fails)

### 2. GOTO-SUPPORT-REQUEST.md
**Location:** `GOTO-SUPPORT-REQUEST.md` (already in your repo)

**What it shows:**
- Detailed technical breakdown of both issues
- Specific requests (grant org admin permissions, provision Contact Center features)
- All account identifiers

### 3. working-endpoints-reference.md
**Location:** `goto-support-attachments/working-endpoints-reference.md`

**What it shows:**
- List of 6+ GoTo APIs that work perfectly with your token
- Proves your OAuth setup is correct
- Demonstrates the issue is specific to queue-caller and SCIM endpoints

---

## 🎯 What Screenshots to Include (Optional)

The attachments above are more useful than screenshots, but if you want visual proof:

### Screenshot 1: Developer Portal Scopes
- Go to GoTo developer portal
- Show your OAuth client with all scopes enabled
- Highlight `queue-caller.v1.read` and `cc-analytics.v1.agent-status.read`

### Screenshot 2: 404 Error from Postman/Thunder Client
- Show a request to `https://api.goto.com/queue-caller/v1/calls`
- With Authorization header (Bearer token - redact the actual token)
- Showing 404 response with `{"errorCode":"NOT_FOUND"}`

### Screenshot 3: SCIM 401 Error
- Show request to `https://api.getgo.com/identity/v1/Users`
- With same Bearer token
- Showing 401 response with `"not.authorized"`

**But honestly, the JSON files are better** - they show the same info in machine-readable format.

---

## 📝 How to Send

1. **Compose email** using the draft in `GOTO-SUPPORT-EMAIL-DRAFT.md`

2. **Attach these 3 files:**
   - `goto-support-attachments/debug-token-response.json`
   - `GOTO-SUPPORT-REQUEST.md`
   - `goto-support-attachments/working-endpoints-reference.md`

3. **Send to:** Whatever email address the support rep gave you

4. **CC yourself** so you have a record

---

## 🎯 Expected Outcome

**Best case:** They escalate to API team who responds within 1-2 business days with:
- "Contact Center analytics not enabled - we've provisioned it for account 8778469392336402103"
- "We've granted Organization Admin to noah@nationwidetransportservices.com"
- Working endpoint URLs if docs are wrong

**Likely case:** Auto-reply, then 3-5 day wait, then escalation to someone competent

**Worst case:** They ask you to re-authenticate or try basic troubleshooting you've already done. Reply with "Please see attached debug-token-response.json showing all scopes are granted. This is a provisioning issue, not an authentication issue."

---

## 💡 Pro Tips

### If they ask "have you tried re-authenticating?"
**Response:** "Yes. The debug-token-response.json shows all requested scopes were successfully granted in the OAuth token (sc claim in JWT). The issue is not scope authorization - it's that the endpoints return 404 (not provisioned) or 401 (insufficient org permissions)."

### If they ask "are you sure you have the right scopes?"
**Response:** "Yes. See debug-token-response.json - `hasQueueCallerScope: true` and `hasCcAnalyticsScope: true` confirm the scopes are in the token. Other APIs using the same token work perfectly (see working-endpoints-reference.md)."

### If they say "this is a coding issue, we can't help"
**Response:** "This is not a coding issue. Our code works for 6+ other GoTo APIs. We need to know: (1) Does our account have Contact Center features provisioned? (2) Does SCIM require org-level admin privileges not documented in the API reference?"

---

## 🔥 The Nuclear Option (If They Keep Stonewalling)

If after 2-3 back-and-forth emails they're still unhelpful:

**Ask to speak to:**
- Developer Relations team
- API Product Manager
- Escalation to supervisor

**Mention:**
- You're a paying GoTo Connect customer
- You have a production integration deadline
- Multiple other APIs work fine (you're not incompetent)
- You just need clarity on account provisioning

**Leverage:**
- "We're happy to provide more details to your engineering team. Can you set up a 15-minute call with someone from developer relations?"

---

Good luck! Their support is frustrating but once you get to the right person (API team, not front-line), they should be able to fix this quickly.
