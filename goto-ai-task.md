# Performance Dashboard With GoTo API/AI
> 04-10-2026

### Notes from Julian (CIO)
Aside from evaluating all of the calls akin one summary? Would be good to show one by one too, and also show following points

1. Valid / Not Valid
2. Type of call (Shipping quote, customer service, junk etc)
3. Discovery performed?
3. 1 Discovery Results (high quality client, one time, etc)
4. Closing skills performance
5. Clear next steps set?

Then overall sentimented good or bad performance

If we can see each one then summarized would be good to review with them going down the list

### Notes from me (Noah)

**Issue:** Our Sales Reps/Brokers haven't been performing up to company standards. We have freight brokers who have been with the company for years and still don't have any shipper/customer accounts and have been basically living off of one-time shipments. 

Multiple reasons for this happening:
- Brokers over-pricing to get higher margins (instant gratification sort of thing)
- Broker's are not valuing clients - we strongly focus our marketing which results in 100s of inbound calls/leads daily, if a broker does a bad job for a customer or the customer turns down an extremely high rate, "well who cares, I'll just wait on the next phone call for another customer and try again." < very bad mentality.
- Broker's are not asking qualifying questions and following other requirements as we've trained them to such as:
  - Proper introduction (of company and broker)
  - What's your current shipping solution?
  - How often do you ship?
- Broker's are doing a poor job on following up.

I've added some screenshots and added some spreadsheets exported from our GoTo Analytics Dashboard inside of the zgo-to-call-reports/ folder for context of the data we're working with.

Let's add @ui-ux-designer to provide research and implementation to make a knock-out Performance Dashboard



scopes

Scopes

Select the scopes this client will need to request. The user getting access will need product or admin privileges.

Profile

For an authenticated user

Get user information

Modify user details

[identity:scim.me]

GoToMeeting, GoToWebinar, or GoToTraining

Create, start and modify sessions for remote collaboration

[collab:]

LogMeIn Resolve and GoToAssist Remote Support/Service Desk

Create, start and modify sessions for real-time support

[support:]

SCIM

Automated user management

[identity:scim.org]

Admin Center

Manage users across GoTo products

[identity:]

GoTo Connect

Initiating phone calls and other telephony services


Advanced permissions

Modify voice entities like phone numbers, devices and extensions

[voice-admin.v1.write]

Update/Delete your voicemails

[voicemail.v1.voicemails.write]

Manage call parking subscriptions

[call-parking.v1.notifications.manage]

Manage notification subscriptions for call history

[call-history.v1.notifications.manage]

Control various features associated with a call

[call-control.v1.calls.control]

Access voice entities like phone numbers, devices and extensions

[voice-admin.v1.read]

Manage notifications for faxes

[fax.v1.notifications.manage]

Retrieve call events

[call-events.v1.events.read]

Access your messages and media

[messaging.v1.read]

View reporting analytics for queue calls

[queue-caller.v1.read]

Perform actions on web calls (such as create, answer...)

[webrtc.v1.write]

Read your voicemails

[voicemail.v1.voicemails.read]

View reporting analytics for agent status.

[cc-analytics.v1.agent-status.read]

Insert, update, or delete integration contacts

[contacts.v1.write]

Manage notification subscriptions for presence

[presence.v1.notifications.manage]

Update or delete messages

[messaging.v1.write]

Manage notification subscriptions for recordings

[recording.v1.notifications.manage]

Start a call on your phone line

[calls.v2.initiate]

Manage notification subscriptions for voicemails

[voicemail.v1.notifications.manage]

Send messages and media on your behalf

[messaging.v1.send]

Access faxes

[fax.v1.read]

Manage notifications for messages and media

[messaging.v1.notifications.manage]

Access parked calls and call permissions

[call-parking.v1.read]

Write self user presence including "Do Not Disturb"

[presence.v1.write]

Retrieve information about web calls

[webrtc.v1.read]

Read contacts

[contacts.v1.read]

Update or delete faxes

[fax.v1.write]

Retrieve call recordings and transcripts

[recording.v1.read]

Manage call asset subscriptions

[asset.v1.notifications.manage]

Manage notification subscriptions for call events

[call-events.v1.notifications.manage]

Read presence for self and other users

[presence.v1.read]

Access call history for phone lines in the PBX

[cr.v1.read]

Retrieve your phone line information

[users.v1.lines.read]

Retrieve various GoTo Connect settings of the authenticated user

[users.v1.read]
