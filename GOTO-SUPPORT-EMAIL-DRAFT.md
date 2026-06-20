# Email to GoTo Support - API Documentation Request

**Subject:** API Documentation Issue - Contact Center & SCIM Endpoints (Case Escalation Required)

---

Dear GoTo Support Team,

I'm writing to request escalation to your API engineering team regarding documented endpoints that are returning unexpected errors despite proper OAuth configuration. During my support call today (April 12, 2026), I was asked to provide detailed error information via email for escalation.

## Background

We are integrating GoTo Connect into a production freight broker CRM application (NTS Claims Tracker) to provide call analytics and performance coaching features for our sales team. We have successfully implemented OAuth 2.0 authentication and several working API endpoints, but are encountering issues with Contact Center and SCIM APIs that appear to be **account provisioning or documentation discrepancies** rather than implementation errors.

**To be clear:** We are not requesting coding assistance. We need clarification on whether these APIs require special account provisioning, or if the documentation references outdated/incorrect endpoints.

---

## Issue #1: Contact Center Analytics APIs Return 404 Despite Having Scopes and Permissions

### OAuth Scopes Successfully Granted
Our OAuth token includes these Contact Center scopes (verified via JWT decode):
```
voice-admin.v1.read         ✅ (works for /call-queues endpoint)
queue-caller.v1.read        ✅ (granted but no working endpoints found)
cc-analytics.v1.agent-status.read  ✅ (granted but no working endpoints found)
```

### Working Endpoint (Proves voice-admin.v1.read scope works)
```
✅ GET https://api.goto.com/voice-admin/v1/call-queues → 200 OK
   Returns queue list: {"items": [{"id": "...", "name": "After-Hour Auto Transport Call Que", ...}]}
```

### Analytics Endpoints Tested (All Return 404)
We tested **9 different endpoint patterns** across multiple namespaces. All return `404 NOT_FOUND`:

**voice-admin namespace (same as working call-queues endpoint):**
```
❌ GET https://api.goto.com/voice-admin/v1/queue-calls → 404 NOT_FOUND
❌ GET https://api.goto.com/voice-admin/v1/call-queue-analytics → 404 NOT_FOUND
❌ GET https://api.goto.com/voice-admin/v1/analytics/queue-calls → 404 NOT_FOUND
```

**queue-caller namespace:**
```
❌ GET https://api.goto.com/queue-caller/v1/calls → 404 NOT_FOUND
❌ GET https://api.goto.com/queue-caller/v1/conversations → 404 NOT_FOUND
```

**cc-analytics namespace:**
```
❌ GET https://api.goto.com/cc-analytics/v1/queue-calls → 404 NOT_FOUND
```

**Alternative namespaces:**
```
❌ GET https://api.goto.com/analytics/v1/queue-calls → 404 NOT_FOUND
❌ GET https://api.goto.com/reporting/v1/queue-calls → 404 NOT_FOUND
```

**Consistent Error Response:**
```json
{
  "errorCode": "NOT_FOUND",
  "message": "The requested resource was not found"
}
```

### What We've Ruled Out
- ✅ OAuth scopes are present in JWT token (confirmed via decode)
- ✅ Authentication works (call-history, admin/me, call-queues all return 200)
- ✅ Account key is correct (8778469392336402103)
- ✅ Admin user has "RUN_REPORTS" role in adminRoles array
- ✅ We can list queues via voice-admin API (proves voice-admin.v1.read scope is functional)

### Questions for GoTo Team
1. **What is the correct API endpoint for queue call analytics/performance data?**
   - We can list queues but cannot retrieve call records for those queues
   - All documented analytics endpoints return 404

2. **Does our account require "GoTo Contact Center Analytics" feature enabled?**
   - Account: Nationwide Transport Services, LLC (accountKey: `8778469392336402103`)
   - Current products: `["ATTENDANTCONSOLE", "JIVE", "G2M", "G2C"]`
   - If this is a plan limitation, what subscription includes analytics API access?

3. **Is there undocumented endpoint path mapping?**
   - `voice-admin.v1.read` scope → `/voice-admin/v1/call-queues` works ✅
   - `queue-caller.v1.read` scope → which endpoint path should we use? All tested paths return 404

---

## Issue #2: SCIM API Returns 401 "not.authorized"

### OAuth Scope Successfully Granted
- Scope `identity:` is present in OAuth token ✅
- SCIM documentation states this scope enables SCIM endpoints

### Endpoint Tested
```
GET https://api.getgo.com/identity/v1/Users
Accept: application/scim+json
```

**Error Response:**
```json
{
  "error": [{
    "description": "Incident #1pcesdf3b2e02",
    "code": "not.authorized",
    "uri": "/v1/Users"
  }]
}
```

### Root Cause Identified
The admin user (`noah@nationwidetransportservices.com`, userKey: `4325746367515308727`) has:
- ✅ Account-level admin roles (MANAGE_USERS, MANAGE_SETTINGS, etc.)
- ❌ **`orgAdmin: false`** (missing Organization-level permissions)
- ❌ No `organizationRoles` array in `/admin/rest/v1/me` response

### Question for GoTo Team
**Does SCIM API access require Organization Admin privileges?** If so, please grant `ROLE_ORG_READ` to user `noah@nationwidetransportservices.com` (userKey: `4325746367515308727`).

If organization-level access is not required, please advise why the SCIM endpoint returns 401 despite having the `identity:` scope.

---

## Account & Authentication Details

**OAuth Client ID:** `bc8a558e-99c9-42a9-9a51-9a0ce641a0c6`  
**Account:** Nationwide Transport Services, LLC  
**Account Key (numeric):** `8778469392336402103`  
**Account UUID:** `a45e1aca-8a7d-4851-9aae-ee534f8380f4`  
**Admin User:** Noah Adam (`noah@nationwidetransportservices.com`)  
**User Key:** `4325746367515308727`

**All requested OAuth scopes successfully granted** (verified in JWT `sc` claim):
```
voice-admin.v1.read, calls.v2.initiate, call-events.v1.notifications.manage,
identity:, cr.v1.read, users.v1.lines.read, queue-caller.v1.read,
call-events.v1.events.read, voicemail.v1.voicemails.read, users.v1.read,
cc-analytics.v1.agent-status.read
```

---

## Attachments Provided

1. **debug-token-response.json** - Complete diagnostic output showing:
   - Decoded JWT token with all granted scopes
   - HTTP probe results for all queue-caller endpoints (all 404)
   - SCIM API 401 response
   - Admin user permissions from `/admin/rest/v1/me`

2. **GOTO-SUPPORT-REQUEST.md** - Detailed technical documentation of both issues

3. **working-endpoints-reference.md** - List of successfully working GoTo APIs (proves authentication is correct)

---

## Previous Support Interaction

During a previous support call several months ago (late 2025), your team acknowledged that some GoTo Connect API documentation was outdated and being updated. We suspect these endpoints may have changed domains, versioning, or provisioning requirements that are not reflected in current documentation.

---

## Requested Action

Please escalate this case to your API engineering or developer relations team to:

1. **Confirm whether Contact Center Analytics APIs require special account provisioning** beyond OAuth scopes, or provide corrected endpoint URLs if documentation is outdated

2. **Clarify SCIM API access requirements** - specifically whether Organization Admin privileges are required, and if so, grant those privileges to our admin user

3. **Provide updated API documentation** for Contact Center analytics endpoints that reflects current production API paths and requirements

We have a production deadline and understand front-line support focuses on end-user issues rather than API integration. We appreciate your assistance in routing this to the appropriate technical team.

---

**Best regards,**  
Noah Adam  
CTO, Nationwide Transport Services  
noah@nationwidetransportservices.com  
Account: Nationwide Transport Services, LLC (Account Key: 8778469392336402103)

---

**P.S.** We have successfully integrated multiple GoTo APIs (call history, voicemail, device management, click-to-dial) and are active GoTo Connect customers. These issues are specifically about accessing Contact Center analytics features we expect to be available given our subscription and granted OAuth scopes.
