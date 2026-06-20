# GoTo Connect — Recording & Transcription API Reference

**Source:** https://developer.goto.com/GoToConnect#tag/Recording-Overview

---

## Overview

### Permission

The user needs to have the **"Access call recordings"** permission to use any endpoint of this API.  
See: https://support.goto.com/connect/help/how-do-i-give-a-user-and-user-group-reporting-permissions

### Finding `recordingId` and `transcriptId`

The `recordingId` and `transcriptId` can be found by subscribing to recording notifications:
- `id` in **`RECORDING_UPLOADED`** events → `recordingId`
- `id` in **`RECORDING_TRANSCRIPT_UPLOADED`** events → `transcriptId`

The `recordingId` for a given leg can also be found in the **call events report**. If the field `transcriptEnabled` is `true`, the **same id** can be used to fetch a transcript.

---

## Recording Subscriptions

> **Required scope:** `recording.v1.notifications.manage`

### `POST /recording/v1/subscriptions`

Create a subscription for the user defined in the authorization token. Activates notifications toward the provided notification channel ID. The request may contain one or more event types.

**Request body** (`application/json`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountKey` | string | ✅ | An account key |
| `channelId` | string (uuid) | ✅ | The notification channel's ID |
| `eventTypes` | string[] | ✅ | One or more of: `RECORDING_UPLOADED`, `RECORDING_TRANSCRIPT_UPLOADED` |

**Request example:**

```javascript
var axios = require("axios").default;

var options = {
  method: 'POST',
  url: 'https://api.goto.com/recording/v1/subscriptions',
  data: {
    accountKey: '1555226665',
    channelId: 'cfeb8e9a-495c-4e48-b3bf-fe1b4cf1cf76',
    eventTypes: ['RECORDING_UPLOADED']
  }
};

axios.request(options).then(res => console.log(res.data)).catch(console.error);
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `201` | Subscription created. Returns `{ id, accountKey, channelId, timestamp, eventTypes }` |
| `400` | Bad request — `BAD_REQUEST` or `MALFORMED_REQUEST` |
| `401` | Auth error — `AUTHN_INVALID_TOKEN`, `AUTHN_EXPIRED_TOKEN`, etc. |
| `403` | Unauthorized |
| `409` | Conflict with existing resource |
| `429` | Rate limited — retry later |
| `500` | Unknown server error |

**Callback payload example** (sent to your channel on recording upload):

```json
{
  "source": "string",
  "type": "string",
  "usage": "VOIP",
  "timestamp": "2019-08-24T14:15:22Z",
  "ttl": 3600,
  "bypassDoNotDisturb": false,
  "content": {
    "recordingId": "bbd0b35c-32e1-4c5f-b1be-7f8fdbe015f2"
  }
}
```

---

### `GET /recording/v1/subscriptions`

List all subscriptions for the user defined in the authorization token. Users can only retrieve subscriptions they own.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `pageMarker` | string | Pagination cursor from a previous response |
| `pageSize` | integer (0–100) | Max items per page (default: 50) |

**Responses:**

| Status | Meaning |
|--------|---------|
| `200` | Returns `{ NextPageMarker, items[] }` |
| `400` | Invalid `pageMarker` or `pageSize` |
| `401` | Auth error |
| `403` | Unauthorized |
| `429` | Rate limited |
| `500` | Unknown server error |

---

### `DELETE /recording/v1/subscriptions/{subscriptionId}`

Delete a subscription by ID.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `subscriptionId` | any | Unique subscription identifier |

**Responses:**

| Status | Meaning |
|--------|---------|
| `204` | Successfully deleted |
| `400` | Bad request |
| `401` | Auth error |
| `403` | Unauthorized |
| `404` | Subscription not found |
| `429` | Rate limited |
| `500` | Unknown server error |

---

## Recordings

> **Required scope:** `recording.v1.read`

### `GET /recording/v1/recordings/{recordingId}/content`

Generates a **short-lived content token** used to build a download link to the recording audio.

> **Note:** Only works for recordings with status `UPLOADED`. Returns `400` for other statuses.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `recordingId` | string | Recording identifier |

**Request example:**

```javascript
var options = {
  method: 'GET',
  url: 'https://api.goto.com/recording/v1/recordings/{recordingId}/content'
};
```

**Response `200`:**

```json
{
  "token": "string",
  "expires": "2019-08-24T14:15:22Z"
}
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `200` | Returns `{ token, expires }` — use token to construct download URL |
| `400` | Recording not in `UPLOADED` status, or malformed request |
| `401` | Auth error |
| `403` | `AUTHZ_INSUFFICIENT_SCOPE` — token lacks `recording.v1.read` |
| `404` | Recording not found |
| `406` | Unsupported `Accept` format |
| `429` | Rate limited |
| `500` / `502` / `503` / `504` | Server/routing error |

---

### `GET /recording/v1/recordings/{recordingId}/content/{token}`

Returns the actual **recording audio content** (302 redirect to file).

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `recordingId` | string | Recording identifier |
| `token` | string | Token obtained from the `/content` endpoint above |

**Responses:**

| Status | Meaning |
|--------|---------|
| `302` | Redirect to audio content |
| `400` | Bad request |
| `401` | Auth error |
| `403` | `AUTHZ_INSUFFICIENT_SCOPE` |
| `404` | Not found |
| `429` | Rate limited |
| `500` | Unknown server error |

---

## Transcriptions

> **Required scope:** `recording.v1.read`

### `GET /recording/v1/transcriptions/{transcriptId}`

Returns the transcription content via an **HTTP 302 redirect**. Node's `fetch` follows redirects automatically so the response body will be the JSON transcript.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `transcriptId` | string | Transcript identifier (same as `recordingId` when `transcriptEnabled=true`) |

**Request example:**

```javascript
var options = {
  method: 'GET',
  url: 'https://api.goto.com/recording/v1/transcriptions/{transcriptId}'
};
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `302` | Redirect to transcript JSON (auto-followed by fetch) |
| `401` | Auth error |
| `403` | `AUTHZ_INSUFFICIENT_SCOPE` — token lacks `recording.v1.read` |
| `404` | Transcript not found |
| `429` | Rate limited |
| `500` | Unknown server error |

---

## Transcript Format (Version 1)

The transcript JSON returned after following the redirect:

```json
{
  "version": "1",
  "results": [
    {
      "type": "utterances",
      "transcript": "Hello, how can I help you?",
      "final": true,
      "startTimeMs": 0,
      "endTimeMs": 2000,
      "channel": 0,
      "languageCode": "en"
    }
  ]
}
```

**Field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Always `"1"` |
| `type` | string | Always `"utterances"` |
| `transcript` | string | The words spoken |
| `final` | boolean | Always `true` (final transcript) |
| `startTimeMs` | integer | Milliseconds from recording start when words began |
| `endTimeMs` | integer | Milliseconds from recording start when words ended |
| `channel` | integer | `0` = what participant **said** (agent voice); `1` = what participant **heard** (customer voice). Mono recordings use channel `0` only. |
| `languageCode` | string | ISO 639-1 language code (e.g. `"en"`) |

---

## Notes for This Project

- **`recordingId` = `transcriptId`** when `transcriptEnabled=true` on the call record.
- The **queue-caller API** returns a `conversationSpaceId` per call leg — being tested as a potential `transcriptId` source since the call-history admin proxy returns 404 for non-owner users.
- Subscriptions (`recording.v1.notifications.manage`) are **not needed** to fetch recordings/transcripts — only `recording.v1.read` is required, which the admin token already has.
