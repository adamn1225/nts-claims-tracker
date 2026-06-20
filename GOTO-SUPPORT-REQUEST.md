# GoTo Contact Center API Issue - Support Request

**Date:** April 12, 2026 (Updated)  
**Account:** Nationwide Transport Services  
**Account Key:** `8778469392336402103`  
**UUID:** `a45e1aca-8a7d-4851-9aae-ee534f8380f4`  
**Admin User:** Noah Adam (`noah@nationwidetransportservices.com`, userKey: `4325746367515308727`)

---

## Issue Summary

Two separate API access issues identified:

### Issue 1: SCIM API Returns 401 "not.authorized"
- **API:** `GET https://api.getgo.com/identity/v1/Users`
- **Scope:** `identity:` ✅ Granted in OAuth token
- **Error:** `401 {"code":"not.authorized","uri":"/v1/Users"}`
- **Root Cause:** Admin user lacks **Organization-level permissions**
- **User Status:** 
  - `orgAdmin: false` ❌
  - No `organizationRoles` array in `/me` response
  - Has all **account-level** admin roles ✅
  - Missing **ROLE_ORG_READ** organization role ❌

### Issue 2: Contact Center APIs Return 404 (NOT_FOUND)
- **Tested Endpoints (All Return 404):**
  ```
  GET https://api.goto.com/queue-caller/v1/calls
  GET https://api.goto.com/queue-caller/v1/conversations
  GET https://api.goto.com/cc-analytics/v1/queue-calls
  ```
- **OAuth Scopes:** ✅ `queue-caller.v1.read` and `cc-analytics.v1.agent-status.read` successfully granted
- **Root Cause:** Contact Center backend features not provisioned on account
- **Error Response:**
  ```json
  {
    "errorCode": "NOT_FOUND",
    "message": "The requested resource was not found"
  }
  ```

### Working Endpoints (for reference):
```
✅ GET https://iam.servers.getgo.com/ext-admin/rest/accounts/{key}/users (Legacy IAM Admin API)
✅ GET https://api.getgo.com/admin/rest/v1/me (Admin API - account level)
✅ GET https://api.goto.com/call-history/v1/calls (User-scoped call history only)
```

---

## OAuth Configuration (Verified Working)

**Client ID:** `bc8a558e-99c9-42a9-9a51-9a0ce641a0c6`  
**Scopes Requested:**
```
calls.v2.initiate
call-events.v1.notifications.manage
call-events.v1.events.read
voice-admin.v1.read
cr.v1.read
voicemail.v1.voicemails.read
users.v1.read
users.v1.lines.read
identity:
queue-caller.v1.read
cc-analytics.v1.agent-status.read
```

**Scopes Granted in Token:** ✅ All scopes successfully granted  
**Token Decoded Confirmation:**
```json
{
  "sc": "voice-admin.v1.read calls.v2.initiate call-events.v1.notifications.manage identity: cr.v1.read users.v1.lines.read queue-caller.v1.read call-events.v1.events.read voicemail.v1.voicemails.read users.v1.read cc-analytics.v1.agent-status.read",
  "sub": "4325746367515308727",
  "ls": "a45e1aca-8a7d-4851-9aae-ee534f8380f4"
}
```

**OAuth client configured with scopes: CONFIRMED via screenshot showing all Contact Center scopes enabled in developer portal** ✅

---

## Current Admin User Permissions

**From `/admin/rest/v1/me` endpoint:**
```json
{
  "key": "4325746367515308727",
  "accountKey": "8778469392336402103",
  "email": "noah@nationwidetransportservices.com",
  "orgAdmin": false,                    // ❌ Not an organization admin
  "adminRoles": [                       // ✅ Has ALL account-level admin roles
    "MANAGE_SETTINGS",
    "VIEW_INVOICES", 
    "MANAGE_SEATS",
    "VIEW_AND_PAY_INVOICES",
    "MANAGE_ACCOUNT",
    "VIEW_CALL_RECORDINGS",
    "MANAGE_DEVICE_GROUPS",
    "MANAGE_EMERGENCY_SERVICES",
    "MANAGE_GROUPS",
    "MANAGE_SETTINGS_PROFILES",
    "RUN_REPORTS",
    "MANAGE_USERS"
  ],
  "products": ["ATTENDANTCONSOLE", "JIVE", "G2M", "G2C"]
}
```

**Missing:** `organizationRoles` array (would contain `ROLE_ORG_READ`, `ROLE_ORG_WRITE` if granted)

---

## Request to GoTo Support

### 1. Grant Organization-Level Permissions (for SCIM API access)

**Please grant Organization Admin permissions to user Noah Adam (`noah@nationwidetransportservices.com`, userKey: `4325746367515308727`).**

**Specific roles needed:**
- `ROLE_ORG_READ` - Required for SCIM API `/identity/v1/Users` endpoint
- OR promote user to full "Organization Administrator"

**Current Status:** User has all account-level admin roles but lacks organization-level roles (`orgAdmin: false`)

**SCIM API Documentation Reference:**
> "Queries multiple user identities in the organization domain. This call requires the role **ROLE_ORG_READ**."
> Source: https://developer.goto.com/Scim/#tag/Users/operation/getUsers

**Business Impact:** Without SCIM API access, we're limited to legacy IAM Admin API which may be deprecated. SCIM is the modern standard (RFC 7644) for user provisioning and management.

---

### 2. Enable Contact Center Backend Features (for queue-caller API access)

**Please enable Contact Center Analytics features on account `8778469392336402103`.**

**Required API endpoints:**
- `queue-caller.v1` - Call queue analytics with agent attribution
- `cc-analytics.v1` - Contact Center agent status and performance metrics

**Current Issue:** OAuth scopes are granted ✅ but endpoints return 404, indicating backend features not provisioned.

**Business Justification:**
We are building an internal call performance monitoring dashboard to track call metrics across our **234 employees company-wide**. This is required for:
- Compliance monitoring under new company policies
- Quality assurance and training
- Performance analytics for 234 users across all departments
- Real-time monitoring needs (not just historical reports)

**Current Workaround Limitations:**
- `/call-history/v1/calls` only returns authenticated user's calls (user-scoped)
- Currently shows only Noah's 964 calls across 9 DIDs
- Cannot access other 233 employees' call data for company-wide monitoring

**Alternative if queue-caller not available:**
If Contact Center Analytics is not included in our current GoTo Connect (JIVE) plan, please advise:
1. What plan/addon is required for `queue-caller.v1` API access?
2. Pricing for Contact Center Analytics addon
3. Whether org-wide call monitoring is achievable with current JIVE product

---

## Account Details

**Product:** GoTo Connect (JIVE) + Attendant Console  
**Users:** 234 active users  
**Account Type:** Business/Enterprise  
**Current Plan:** [Please confirm - appears to be GoTo Connect without Contact Center addon]

---

## Technical Contact

**Name:** Noah Adam  
**Email:** noah@nationwidetransportservices.com  
**Role:** Account Administrator  
**Developer Portal:** OAuth client `bc8a558e-99c9-42a9-9a51-9a0ce641a0c6` registered and approved

---

## Supporting Evidence

**Debug Endpoint Results:** Available at `[internal application]/api/goto/debug-token`

**Token Scopes Verified:**
```json
{
  "hasQueueCallerScope": true,
  "hasCcAnalyticsScope": true,
  "tokenScopes": [
    "voice-admin.v1.read",
    "calls.v2.initiate",
    "identity:",
    "queue-caller.v1.read",
    "cc-analytics.v1.agent-status.read",
    ...
  ]
}
```

**API Probe Results:** All 5 Contact Center endpoints tested return `404 NOT_FOUND`

**Legacy APIs Working:**
- ✅ IAM Admin API returns 234 users successfully
- ✅ Admin API `/me` endpoint returns user details
- ✅ Call-history API returns user-scoped calls (964 for Noah)

---

## Expected Outcome

1. **SCIM API Access:** After granting `ROLE_ORG_READ`, `/identity/v1/Users` should return `200 OK` instead of `401`
2. **Contact Center API Access:** After backend provisioning, `queue-caller.v1` and `cc-analytics.v1` endpoints should return `200 OK` with data instead of `404`
3. **Org-Wide Monitoring:** Ability to fetch and monitor call data for all 234 employees, not just authenticated user

---

**Thank you for your assistance!**

---

## Workaround (Temporary)

Currently using user-scoped `cr.v1.read` (call-history API) which only returns authenticated user's calls. This is insufficient for company-wide monitoring needs.

---

## Expected Resolution Timeline

Please advise on:
1. Whether Contact Center features can be enabled on our existing account
2. If plan upgrade is required, which tier includes these features
3. Estimated timeline for feature activation

Thank you for your assistance!
