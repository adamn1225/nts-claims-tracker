## Subscribe to recording notifications

**post**/recording/v1/subscriptions

Create a subscription for the user defined in the authorization token. The subscription activates notifications towards the provided notification channel ID. The request may contain one or more event types to subscribe to.

### Authentication Scopes

`recording.v1.notifications.manage` must be used when a token is requested from the Authentication API.

##### Request Body schema: **application/json**

| **accountKey**required | **string**An account key                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **channelId**required  | **string** **`<uuid>`**The notification channel's ID.                                                                                                                |
| **eventTypes**required | **Array of** **strings**Items **Enum:** **"RECORDING_UPLOADED"** **"RECORDING_TRANSCRIPT_UPLOADED"**List of one or more event types to subscribe to. |

### Responses

**201**Content of the new subscription.

| **id**         | **any**Unique identifier for the subscription.                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **accountKey** | **string**The accountKey for which the subscription was made                                                                                                                         |
| **channelId**  | **string** **`<uuid>`**The notification channel's ID.                                                                                                                              |
| **timestamp**  | **string** **`<date-time>`**The time when the subscription was created                                                                                                             |
| **eventTypes** | **Array of** **strings**Items **Enum:** **"RECORDING_UPLOADED"** **"RECORDING_TRANSCRIPT_UPLOADED"**List of one or more types of events that have been subscribed. |

**400**The request has one or more issues. The API returns a number of `errorCode` values in the response that provide additional details. The response may contain one ore more values in `constraintViolations` to provide additional details useful in debugging.

* BAD_REQUEST - The request is not valid.
* MALFORMED_REQUEST - The request is malformed and not interpretable.

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization.

* `UNAUTHORIZED` - The principal represented by the supplied token is not authorized to perform the specified action on the targeted resource and has the ability to read (GET) the targeted resource.

**409**The request could not be completed due to a conflict with the target resource.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.

### Callbacks

post**RecordingNotification**

### Request samples

* Payload
* Node + Axios
* Shell + Curl
* Python + Python3
* Php + Http2
* Ruby + Native

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"accountKey"</span>:<span> </span><span class="token string">"1555226665"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-neayy1s"><div class="hoverable "><span class="property token string">"channelId"</span>:<span> </span><span class="token string">"cfeb8e9a-495c-4e48-b3bf-fe1b4cf1cf76"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"eventTypes"</span>:<span> </span><span class="token punctuation">[</span><ul class="array collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="token string">"RECORDING_UPLOADED"</span></div></li></ul><span class="token punctuation">]</span></div></li></ul><span class="token punctuation">}</span>`

### Response samples

* 201
* 400
* 401
* 403
* 429
* 500

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"id"</span>:<span> </span><span class="token keyword">null</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-lndbwnr"><div class="hoverable "><span class="property token string">"accountKey"</span>:<span> </span><span class="token string">"string"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"channelId"</span>:<span> </span><span class="token string">"5f6d08bc-455a-4532-98b8-19e2cee51160"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-9j5arwl"><div class="hoverable "><span class="property token string">"timestamp"</span>:<span> </span><span class="token string">"2019-08-24T14:15:22Z"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"eventTypes"</span>:<span> </span><span class="token punctuation">[</span><ul class="array collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="token string">"RECORDING_UPLOADED"</span></div></li></ul><span class="token punctuation">]</span></div></li></ul><span class="token punctuation">}</span>`

### Callback payload samples

**Callback**POST: RecordingNotification

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"source"</span>:<span> </span><span class="token string">"string"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-i7q6dsv"><div class="hoverable "><span class="property token string">"type"</span>:<span> </span><span class="token string">"string"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"usage"</span>:<span> </span><span class="token string">"VOIP"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-mjdm38l"><div class="hoverable "><span class="property token string">"timestamp"</span>:<span> </span><span class="token string">"2019-08-24T14:15:22Z"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"ttl"</span>:<span> </span><span class="token number">3600</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-72ijaw9"><div class="hoverable "><span class="property token string">"bypassDoNotDisturb"</span>:<span> </span><span class="token boolean">false</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"contentVersion"</span>:<span> </span><span class="token string">"string"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-fpb2ilk"><div class="hoverable "><span class="property token string">"content"</span>:<span> </span><span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="property token string">"recordingId"</span>:<span> </span><span class="token string">"bbd0b35c-32e1-4c5f-b1be-7f8fdbe015f2"</span></div></li></ul><span class="token punctuation">}</span></div></li></ul><span class="token punctuation">}</span>`

## Get subscriptions

**get**/recording/v1/subscriptions

Obtains the subscription details of the desired user where the user is defined by the authorization token. Note that users can only retrieve subscriptions they own.

### Authentication Scopes

`recording.v1.notifications.manage` must be used when a token is requested from the Authentication API.

##### query Parameters

| **pageMarker** | **string**The returned `NextPageMarker` from a Paginated Collection is used here to fetch the starting item for the paginated result. |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **pageSize**   | **integer** **`<int32>`** **[ 0 .. 100 ]**Default: **50**The maximum number of items returned in a page.                  |

### Responses

**200**The subscription list

| **NextPageMarker** | **string**The next page marker value, to be used for fetching the next page via the `pageMarker` query parameter. |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **items**          | **Array of** **objects**List of Subscriptions.                                                                |

**400**The `pageMarker` or `pageSize` is invalid

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization.

* `UNAUTHORIZED` - The principal represented by the supplied token is not authorized to perform the specified action on the targeted resource and has the ability to read (GET) the targeted resource.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.

### Request samples

* Node + Axios
* Shell + Curl
* Python + Python3
* Php + Http2
* Ruby + Native

Copy

```
var axios = require("axios").default;

var options = {
  method: 'GET',
  url: 'https://api.goto.com/recording/v1/subscriptions',
  params: {pageMarker: 'SOME_STRING_VALUE', pageSize: 'SOME_INTEGER_VALUE'}
};

axios.request(options).then(function (response) {
  console.log(response.data);
}).catch(function (error) {
  console.error(error);
});
```

### Response samples

* 200
* 400
* 401
* 403
* 429
* 500

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"NextPageMarker"</span>:<span> </span><span class="token string">"string"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-9w3doyw"><div class="hoverable "><span class="property token string">"items"</span>:<span> </span><span class="token punctuation">[</span><ul class="array collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="token punctuation">{</span><span class="ellipsis"></span><span class="token punctuation">}</span></div></li></ul><span class="token punctuation">]</span></div></li></ul><span class="token punctuation">}</span>`

## Remove a subscription on recording notifications.

**delete**/recording/v1/subscriptions/{subscriptionId}

Delete a subscription for a desired ID where the user is defined in the authorization token.

### Authentication Scopes

`recording.v1.notifications.manage` must be used when a token is requested from the Authentication API.

##### path Parameters

| **subscriptionId**required | **any**Unique identifier for the subscription. |
| -------------------------------- | ---------------------------------------------------- |

### Responses

**204**Succesfully removed the subscription.

**400**The request has one or more issues. The API returns a number of `errorCode` values in the response that provide additional details. The response may contain one ore more values in `constraintViolations` to provide additional details useful in debugging.

* BAD_REQUEST - The request is not valid.
* MALFORMED_REQUEST - The request is malformed and not interpretable.

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization.

* `UNAUTHORIZED` - The principal represented by the supplied token is not authorized to perform the specified action on the targeted resource and has the ability to read (GET) the targeted resource.

**404**The specified resource does not exist or the requesting principal does not have the ability to read or modify the specified resource. A `NOT_FOUND` `errorCode` accompanies this response.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.

### Request samples

* Node + Axios
* Shell + Curl
* Python + Python3
* Php + Http2
* Ruby + Native

Copy

```
var axios = require("axios").default;

var options = {
  method: 'DELETE',
  url: 'https://api.goto.com/recording/v1/subscriptions/%7BsubscriptionId%7D'
};

axios.request(options).then(function (response) {
  console.log(response.data);
}).catch(function (error) {
  console.error(error);
});
```

### Response samples

* 400
* 401
* 403
* 404
* 429
* 500

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"reference"</span>:<span> </span><span class="token string">"jhkasdf89hjn3298fs"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-9sopybm"><div class="hoverable "><span class="property token string">"errorCode"</span>:<span> </span><span class="token string">"BAD_REQUEST"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"constraintViolations"</span>:<span> </span><span class="token punctuation">[</span><ul class="array collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="token punctuation">{</span><span class="ellipsis"></span><span class="token punctuation">}</span></div></li></ul><span class="token punctuation">]</span></div></li></ul><span class="token punctuation">}</span>`

# Recordings

## Retrieves a content token used to access the requested recording

**get**/recording/v1/recordings/{recordingId}/content

Generates a short-lived content token used to create a download link to the content. This content token serves as a component to a URL designed to allow a browser's native download capabilities to handle the file download and must be treated as a such. It should not be shared indiscriminently. The returned information contains the expiration date for the returned token. Tokens should not be used after their expiration date.

### Retrieving Content Tokens and Recording status

This API does not generate content tokens for recordings that have not reached the `UPLOADED` status. Calling this endpoint for a recording with a status other than `UPLOADED` results in a `400` response.

### Security

The API only allows access to recordings for organizations associated to the requesting principal and for which this API has been enabled.

### Authentication Scopes

`recording.v1.read` must be used when a token is requested from the Authentication API.

##### path Parameters

| **recordingId**required | **string**Recording identifier |
| ----------------------------- | ------------------------------------ |

### Responses

**200**The content token used to generate a download link

| **token**required   | **string**The token granting access to the content            |
| ------------------------- | ------------------------------------------------------------------- |
| **expires**required | **string** **`<date-time>`**Time at which the token expires |

**400**The request has one or more issues. The API returns a number of `errorCode` values in the response that provide additional details. The response may contain one ore more values in `constraintViolations` to provide additional details useful in debugging.

* BAD_REQUEST - The request is not valid.
* MALFORMED_REQUEST - The request is malformed and not interpretable.

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHZ_INSUFFICIENT_SCOPE` - The supplied token lacks sufficient scopes to perform the requested action on the requested resource type or the request supplied no token. Enforcement of scopes occurs before other authorization decisions and is based solely on the resource type and requested action. This response provides no indication of the existance of the specific resource targeted by the request.

**404**The specified resource does not exist or the requesting principal does not have the ability to read or modify the specified resource. A `NOT_FOUND` `errorCode` accompanies this response.

**406**The accepted response formats supplied with the request are not supported for the requested resource type and operation. Accepted response format detection occurs before other authorization decisions and is based solely on the resource type and requested action. This response provides no indication of the existence of the specific resource targeted by the request. A `NOT_ACCEPTABLE` `errorCode` accompanies this response.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.

**502**There was an issue routing the request. A `UNKNOWN_ERROR` `errorCode` accompanies this response.

**503**There was an issue routing the request. A `UNAVAILABLE` `errorCode` accompanies this response.

**504**There was an issue routing the request. A `UNKNOWN_ERROR` `errorCode` accompanies this response.

### Request samples

* Node + Axios
* Shell + Curl
* Python + Python3
* Php + Http2
* Ruby + Native

Copy

```
var axios = require("axios").default;

var options = {
  method: 'GET',
  url: 'https://api.goto.com/recording/v1/recordings/%7BrecordingId%7D/content'
};

axios.request(options).then(function (response) {
  console.log(response.data);
}).catch(function (error) {
  console.error(error);
});
```

### Response samples

* 200
* 400
* 401
* 403
* 404
* 406
* 429
* 500
* 502
* 503
* 504

**Content type**application/json

Copy

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"token"</span>:<span> </span><span class="token string">"string"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213737-vo0hnqb"><div class="hoverable "><span class="property token string">"expires"</span>:<span> </span><span class="token string">"2019-08-24T14:15:22Z"</span></div></li></ul><span class="token punctuation">}</span>`

## Retrieves the recording content

**get**/recording/v1/recordings/{recordingId}/content/{token}

Returns the recording audio content

##### path Parameters

| **recordingId**required | **string**Recording identifier                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| **token**required       | **string**Token granted via the `/content` path for the supplied `recordingId` |

### Responses

**302**A redirect to the recording content

**400**The request has one or more issues. The API returns a number of `errorCode` values in the response that provide additional details. The response may contain one ore more values in `constraintViolations` to provide additional details useful in debugging.

* BAD_REQUEST - The request is not valid.
* MALFORMED_REQUEST - The request is malformed and not interpretable.

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHZ_INSUFFICIENT_SCOPE` - The supplied token lacks sufficient scopes to perform the requested action on the requested resource type or the request supplied no token. Enforcement of scopes occurs before other authorization decisions and is based solely on the resource type and requested action. This response provides no indication of the existance of the specific resource targeted by the request.

**404**The specified resource does not exist or the requesting principal does not have the ability to read or modify the specified resource. A `NOT_FOUND` `errorCode` accompanies this response.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.



# Transcriptions

## Retrieves the transcription content

**get**/recording/v1/transcriptions/{transcriptId}

Returns the transcription content, via an HTTP redirection.

### Security

The API only allows access to transcriptions for organizations associated to the requesting principal.

### Authentication Scopes

`recording.v1.read` must be used when a token is requested from the Authentication API.

### Transcript Formats

Transcript formats are versioned. They are defined by the `version` field in the transcript content.

See the following object schema definition for more details, note that this is not an example of the object that you will get on the given Location header value but the exact definition of the object. For more information on JSON schemas, please refer to [https://json-schema.org/understanding-json-schema](https://json-schema.org/understanding-json-schema).

#### Version 1 Schema

```

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://goto.com/schemas/transcript/v1",
  "type": "object",
  "description": "Definition of the transcript format version 1",
  "properties": {
    "version": {
      "type": "string",
      "description": "The version of the transcript format",
      "enum": ["1"]
    },
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "type",
          "transcript",
          "final",
          "startTimeMs",
          "endTimeMs",
          "channel"
        ],
        "properties": {
          "type": {
            "type": "string",
            "description": "The type of the transcript",
            "enum": ["utterances"]
          },
          "transcript": {
            "type": "string",
            "description": "The words that were spoken"
          },
          "final": {
            "type": "boolean",
            "description": "Always true since this is the final transcript"
          },
          "startTimeMs": {
            "type": "integer",
            "description": "Timestamp in milliseconds from the start of recording when the associated words started"
          },
          "endTimeMs": {
            "type": "integer",
            "description": "Timestamp in milliseconds from the start of recording when the associated words stopped"
          },
          "channel": {
            "type": "integer",
            "description": "In which channel the words were said. Channel 0 is what the participant said, channel 1 is what the participant heard. If recording was in mono format, everything will be in channel 0"
          },
          "languageCode": {
            "type": "string",
            "description": "Language detected by the transcription engine (ISO 639-1 format)",
            "example": "en"
          }
        }
      }
    }
  },
  "required": ["version", "results"]
}
```

##### path Parameters

| **transcriptId**required | **string**Transcript identifier |
| ------------------------------ | ------------------------------------- |

### Responses

**302**A redirect to the transcription content

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHZ_INSUFFICIENT_SCOPE` - The supplied token lacks sufficient scopes to perform the requested action on the requested resource type or the request supplied no token. Enforcement of scopes occurs before other authorization decisions and is based solely on the resource type and requested action. This response provides no indication of the existance of the specific resource targeted by the request.

**404**The specified resource does not exist or the requesting principal does not have the ability to read or modify the specified resource. A `NOT_FOUND` `errorCode` accompanies this response.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.

### Request samples

* Node + Axios
* Shell + Curl
* Python + Python3
* Php + Http2
* Ruby + Native

Copy

```
var axios = require("axios").default;

var options = {
  method: 'GET',
  url: 'https://api.goto.com/recording/v1/transcriptions/%7BtranscriptId%7D'
};

axios.request(options).then(function (response) {
  console.log(response.data);
}).catch(function (error) {
  console.error(error);
});
```

### Response samples

* 401
* 403
* 404
* 429
* 500

**Content type**application/json

Copy

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"reference"</span>:<span> </span><span class="token string">"jhkasdf89hjn3298fs"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-jice4sr"><div class="hoverable "><span class="property token string">"errorCode"</span>:<span> </span><span class="token string">"AUTHN_INVALID_TOKEN"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"message"</span>:<span> </span><span class="token string">"The supplied authentication token is not valid."</span></div></li></ul><span class="token punctuation">}</span>`

# Web Calls Overview

Provides an API to allow users to create a web-based softphone session in order to be able to make and receive calls as well as receive notifications.

### Authentication Scopes

| Scope           | Description                                              |
| --------------- | -------------------------------------------------------- |
| webrtc.v1.read  | Retrieve information about web calls                     |
| webrtc.v1.write | Perform actions on web calls (such as create, answer...) |

### API Usage Guidelines

This API assumes that clients are implemented in such a way that unknown attributes are ignored. The addition of new response attributes may occur at any time, for any API response, without prior notice. This is not considered a breach of backward compatibility.

### Usage limitations

This API limits the number of requests which it can receive. If the limit is exceeded, a `429` error will be returned.

## Getting started

### Notification Channel

In order to be able to receive events from the Web-Calls service, a notification channel with a configured webhook will have to be available to receive and process these events. Refer to the [Notification Channel API](https://developer.goto.com/GoToConnect#tag/Notification-Channel-Overview) for further details. Each notification sent to the user will have the following form:

```json

{
  "source":"WebRTC",
  "type":"incoming",
  "timestamp": "2020-04-16T21:18:57.008116-04:00",
  "usage": "VOIP",
  "ttl": "30",
  "content": {object}
}
```

Where:

* `source` indicates the name of the application sending the notification (always `WebRTC` in this case).
* `type` indicates the type of notification being sent by that application
* `timestamp` indicates the time at which the application sent the notification.
* `usage` indicates the priority of the notification
* `ttl` indicates the `timeToLive` or `invalidation_time` in seconds that the notification should remain applicable.
* `content` is the object body of whatever the `source` + `type` combination represents.

# Sessions

## Create a new session **Deprecated**

**post**/web-calls/v1/sessions

Creates a new session for an extension to be able to send and receive calls as well as receive notifications. If a session already exists for the given user, organization, and extension, the existing session will be updated with the information provided in the request.

### Authentication Scopes

`webrtc.v1.write` must be used when a token is requested from the Authentication API.

### Example Interaction with curl

```
curl -X "POST" "https://webrtc.jive.com/web-calls/v1/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "01234567-aaaa-0123-bbbb-000000000001",
    "extensionNumber": "1121",
    "clientInformation": {
      "appId": "my-application-name",
      "appVersion": "2.3.1",
      "platform": "INTEGRATOR"
      },
    "callbackReference": {
      "incomingCallChannelId": "0Nda6GSizLlSPskQkKvY5n0rrgND5X5uyPUfzT_FHuwx1p0umr-JNtVuFDZXHhOrh5SIopdBiNov0hcPi-JkDdg",
      "sessionManagementChannelId": "0Nda6GSizLlSPskQkKvY5n0rrgND5X5uyPUfzT_FHuwx1p0umr-JNtVuFDZXHhOrh5SIopdBiNov0hcPi-JkDdg"
    }
  }' \
  -H 'Authorization: Bearer {token}'
```

##### header Parameters

| **Authorization**required | **string**OAuth Token |
| ------------------------------- | --------------------------- |

##### Request Body schema: **application/json**

| **organizationId**required  | **string**Unique ID for the organization.                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **extensionNumber**required | **string**Extension number for the line to register.                                                                                                                           |
| **clientInformation**       | **object**The client's device or browser information used for the creation of a the session.                                                                                   |
| **callbackReference**       | **object**URL to be used to notify the client of an event over their preferred event channel. The callback reference is returned when a client creates a notification channel. |

### Responses

**201**Successfully create the session.

| **id**required                | **string**Unique session ID issued when the session was created. It is used in all subsequent requests and events.                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **expires**                   | **integer** **`<int64>`**Deprecateddeprecated - Not use anymore.                                                                                                             |
| **name**                      | **string**Deprecateddeprecated - Not use anymore..                                                                                                                             |
| **organizationId**required    | **string**Unique ID for the organization.                                                                                                                                      |
| **extensionNumber**required   | **string**Extension number for the line to register.                                                                                                                           |
| **callbackReference**required | **object**URL to be used to notify the client of an event over their preferred event channel. The callback reference is returned when a client creates a notification channel. |
| **calls**required             | **Array of** **objects**List of all active and new incoming calls.                                                                                                       |

**400**The request has one or more issues. The API returns a number of `errorCode` values in the response that provide additional details. The response may contain one ore more values in `constraintViolations` to provide additional details useful in debugging.

* BAD_REQUEST - The request is not valid.
* MALFORMED_REQUEST - The request is malformed and not interpretable.

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNAUTHORIZED` - The principal represented by the supplied token is not authorized to perform the specified action on the targeted resource and has the ability to read (GET) the targeted resource.
* `AUTHZ_INSUFFICIENT_SCOPE` - The supplied token lacks sufficient scopes to perform the requested action on the requested resource type or the request supplied no token. Enforcement of scopes occurs before other authorization decisions and is based solely on the resource type and requested action. This response provides no indication of the existence of the specific resource targeted by the request.

**409**The request could not be completed due to a conflict with the target resource.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.

**503**There was an issue routing the request. A `UNAVAILABLE` `errorCode` accompanies this response.

### Callbacks

post**Greetings**post**IncomingCall**post**Unregistered**post**RefreshRegistrationNeeded**Deprecated

### Request samples

* Payload
* Node + Axios
* Shell + Curl
* Python + Python3
* Php + Http2
* Ruby + Native

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"organizationId"</span>:<span> </span><span class="token string">"01234567-aaaa-0123-bbbb-000000000001"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-7obwsj2"><div class="hoverable "><span class="property token string">"extensionNumber"</span>:<span> </span><span class="token string">"1234"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"clientInformation"</span>:<span> </span><span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="property token string">"appId"</span>:<span> </span><span class="token string">"my-application-name"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-olg6xm0"><div class="hoverable collapsed"><span class="property token string">"appVersion"</span>:<span> </span><span class="token string">"2.3.1"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable collapsed"><span class="property token string">"platform"</span>:<span> </span><span class="token string">"INTEGRATOR"</span></div></li></ul><span class="token punctuation">}</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-4r1ngts"><div class="hoverable "><span class="property token string">"callbackReference"</span>:<span> </span><span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="property token string">"incomingCallChannelId"</span>:<span> </span><span class="token string">"0Nda6GSizLlSPskQkKvY5n0rrgND5X5uyPUfzT_FHuwx1p0umr-JNtVuFDZXHhOrh5SIopdBiNov0hcPi-JkDdg"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-e103q2p"><div class="hoverable collapsed"><span class="property token string">"sessionManagementChannelId"</span>:<span> </span><span class="token string">"0Nda6GSizLlSPskQkKvY5n0rrgND5X5uyPUfzT_FHuwx1p0umr-JNtVuFDZXHhOrh5SIopdBiNov0hcPi-JkDdg"</span></div></li></ul><span class="token punctuation">}</span></div></li></ul><span class="token punctuation">}</span>`

### Response samples

* 201
* 400
* 401
* 403
* 409
* 429
* 500
* 503

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"id"</span>:<span> </span><span class="token string">"someUniqueSessionID"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-pyii276"><div class="hoverable "><span class="property token string">"expires"</span>:<span> </span><span class="token number">0</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"name"</span>:<span> </span><span class="token string">"string"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-zqcy2ih"><div class="hoverable "><span class="property token string">"organizationId"</span>:<span> </span><span class="token string">"dddfbe74-540a-4aa8-9551-ae6202e635df"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"extensionNumber"</span>:<span> </span><span class="token string">"1234"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-uyaj4u6"><div class="hoverable "><span class="property token string">"callbackReference"</span>:<span> </span><span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="property token string">"incomingCallChannelId"</span>:<span> </span><span class="token string">"0Nda6GSizLlSPskQkKvY5n0rrgND5X5uyPUfzT_FHuwx1p0umr-JNtVuFDZXHhOrh5SIopdBiNov0hcPi-JkDdg"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-y431nc0"><div class="hoverable collapsed"><span class="property token string">"sessionManagementChannelId"</span>:<span> </span><span class="token string">"0Nda6GSizLlSPskQkKvY5n0rrgND5X5uyPUfzT_FHuwx1p0umr-JNtVuFDZXHhOrh5SIopdBiNov0hcPi-JkDdg"</span></div></li></ul><span class="token punctuation">}</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"calls"</span>:<span> </span><span class="token punctuation">[</span><ul class="array collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="token punctuation">{</span><span class="ellipsis"></span><span class="token punctuation">}</span></div></li></ul><span class="token punctuation">]</span></div></li></ul><span class="token punctuation">}</span>`

### Callback payload samples

**Callback**POST: GreetingsPOST: IncomingCallPOST: UnregisteredPOST: RefreshRegistrationNeededPOST: Greetings

**Content type**application/json

Copy

Expand allCollapse all

`<span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable "><span class="property token string">"source"</span>:<span> </span><span class="token string">"WebRTC"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-adwt80b"><div class="hoverable "><span class="property token string">"type"</span>:<span> </span><span class="token string">"greetings"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"usage"</span>:<span> </span><span class="token string">"BACKGROUND"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-mnnqkmh"><div class="hoverable "><span class="property token string">"timestamp"</span>:<span> </span><span class="token string">"2022-08-18T19:08:50Z"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable "><span class="property token string">"ttl"</span>:<span> </span><span class="token number">1800</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-21qpavy"><div class="hoverable "><span class="property token string">"content"</span>:<span> </span><span class="token punctuation">{</span><ul class="obj collapsible" data-tight="true"><li><div class="hoverable collapsed"><span class="property token string">"sessionId"</span>:<span> </span><span class="token string">"someUniqueSessionID"</span><span class="token punctuation">,</span></div></li><li data-node-id="20260412213756-1l4nfys"><div class="hoverable collapsed"><span class="property token string">"organizationId"</span>:<span> </span><span class="token string">"75ead78c-85a0-11eb-8dcd-0242ac130003"</span><span class="token punctuation">,</span></div></li><li><div class="hoverable collapsed"><span class="property token string">"extensionNumber"</span>:<span> </span><span class="token string">"1234"</span></div></li></ul><span class="token punctuation">}</span></div></li></ul><span class="token punctuation">}</span>`

## Delete session **Deprecated**

**delete**/web-calls/v1/sessions/{sessionId}

Remove the session and all related calls

### Authentication Scopes

`webrtc.v1.write` must be used when a token is requested from the Authentication API.

### Example Interaction with curl

```
curl -X "DELETE" "https://webrtc.jive.com/web-calls/v1/sessions/0iO2GMahypu5trGOzcfGlGQZLKpUWC2lxvgSLCd" \
  -H 'Authorization: Bearer {token}'
```

##### path Parameters

| **sessionId**required | **string**Session ID issued when the device session was created. |
| --------------------------- | ---------------------------------------------------------------------- |

##### header Parameters

| **Authorization**required | **string**OAuth Token |
| ------------------------------- | --------------------------- |

### Responses

**204**Successfully deleted the session and terminated all associated calls. Clients having subscribed to receive session notifications will receive a SessionNotification with updated status.

**401**There was an error during authentication. The API returns a number of `errorCode` values in the response that provide additional details.

* `AUTHN_INVALID_TOKEN` - The supplied authentication token is not valid.
* `AUTHN_EXPIRED_TOKEN` - The supplied authentication token is expired.
* `AUTHN_MALFORMED_TOKEN` - The supplied authentication token is malformed.
* `AUTHN_UNSUPPORTED_SCHEME` - The supplied authentication scheme is unsupported.

**403**There was an error during authorization. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNAUTHORIZED` - The principal represented by the supplied token is not authorized to perform the specified action on the targeted resource and has the ability to read (GET) the targeted resource.
* `AUTHZ_INSUFFICIENT_SCOPE` - The supplied token lacks sufficient scopes to perform the requested action on the requested resource type or the request supplied no token. Enforcement of scopes occurs before other authorization decisions and is based solely on the resource type and requested action. This response provides no indication of the existence of the specific resource targeted by the request.

**404**The specified resource does not exist or the requesting principal does not have the ability to read or modify the specified resource. A `NOT_FOUND` `errorCode` accompanies this response.

**429**Your request was denied because you have reached some request limit for this API. Try again later.

**500**An unknown error occurred. The API returns a number of `errorCode` values in the response that provide additional details.

* `UNKNOWN_ERROR` - An unknown error occurred.

**503**There was an issue routing the request. A `UNAVAILABLE` `errorCode` accompanies this response.
