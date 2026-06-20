# Notification System Testing Guide

## System Architecture

**IMPORTANT**: This app uses **Supabase pg_cron ONLY** for scheduled notifications.
- ❌ NOT using Netlify scheduled functions
- ✅ Using pg_cron database triggers
- ✅ pg_cron calls `/api/cron/*` endpoints via HTTP

## Quick Tests

### 1. Test Daily Digest Endpoint (Manual)
```bash
# From your terminal
curl -X POST https://nts-pipeline.netlify.app/api/cron/send-daily-digest

# Or with authentication (if CRON_SECRET is set)
curl -X POST https://nts-pipeline.netlify.app/api/cron/send-daily-digest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 2. Test Task Reminders Endpoint
```bash
curl -X POST https://nts-pipeline.netlify.app/api/cron/send-task-reminders
```

### 3. Check Browser Notification Permissions
Open browser console on dashboard and run:
```javascript
// Check permission status
console.log('Notification permission:', Notification.permission);

// Check if polling is active (should log every 60 seconds)
// Look for: "🔔 Starting notification polling for broker: ..."

// Check cooldown timer
console.log('Time until next notification:', 
  window.getTimeUntilNextNotification?.() || 'Not available');
```

### 4. Force Test Browser Notification
```javascript
// In browser console on dashboard
new Notification('Test', { 
  body: 'Testing notification system',
  icon: '/icon-192.png'
});
```

## Verify Supabase pg_cron

Run the SQL queries in `scripts/verify-pg-cron.sql` in Supabase SQL Editor.

**Expected results:**
- 2 scheduled jobs: `check-task-reminders`, `send-daily-digest`
- Recent job runs with status 'succeeded'
- API URL should be: `https://nts-pipeline.netlify.app`

## Common Issues

### Daily Digest Not Sending

**Problem:** Emails stopped arriving
**Cause:** Route only had GET handler, pg_cron uses POST
**Fix:** ✅ FIXED - Added POST handler to route

**Verify pg_cron is calling the endpoint:**
```bash
# Test the endpoint manually (should work now with POST)
curl -X POST https://nts-pipeline.netlify.app/api/cron/send-daily-digest

# Check Supabase logs for HTTP calls from pg_cron
# In Supabase Dashboard: Database > Extensions > pg_net
```

**Check if pg_cron job is scheduled:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM cron.job WHERE jobname = 'send-daily-digest';
```

### Browser Notifications Not Showing

**Likely causes:**
1. **Permission denied** - User declined notification permission
2. **Rate limiting** - 30-minute cooldown between notifications
3. **No unread notifications** - All notifications read/archived
4. **Wrong preference** - localStorage flag disabled

**Debug:**
```javascript
// Check all notification state
console.log({
  supported: 'Notification' in window,
  permission: Notification.permission,
  preference: localStorage.getItem('browserNotificationsEnabled'),
  enabled: Notification.p (FIXED - uses correct column names)
SELECT jobid, jobname, status, return_message, start_time, end_time
FROM cron.job_run_details 
WHERE jobname = 'send-daily-digest' 
ORDER BY start_time DESC 
LIMIT 5;
```

**Common failures:**
- HTTP request timeout (pg_net issue)
- Invalid API URL (app.settings.api_url not set)
- Extension not enabled (pg_cron or pg_net missing)
- Route only accepts GET but pg_cron sends POST ✅ FIXED

**Set API URL if missing:**
```sql
ALTER DATABASE postgres SET app.settings.api_url = 'https://nts-pipeline.netlify.app';
```

**Check pg_cron extension:**
```sql
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net')

**Common failures:**
- HTTP request timeout (pg_net issue)
- Invalid API URL (app.settings.api_url not set)
- Extension not enabled (pg_cron or pg_net missing)

**Set API URL if missing:**
```sql
ALTERSupabase Dashboard Monitoring**
   - Track cron job execution success rate in pg_cron logs
   - Set up email alerts for failed HTTP calls (pg_net)
   - Monitor notification table size and age

2. **Integration Tests**
   - Playwright test: Create task → Verify notification created
   - API test: POST /api/cron/* → Verify email sent
   - Browser test: Grant permission → Verify notification shows

3. **Supabase pg_cron Health Check**
   - Query `cron.job_run_details` for failed jobs
   - Alert if no successful runs in last 24 hours
   - Check pg_net request logs for 500 errors

4. **Application Health Endpoint**
   - `/api/health/notifications` - Returns last successful email time
   - `/api/health/cron` - Returns pg_cron job status
   - Monitor with UptimeRobot or similar

5. **SendGrid Webhook Integration**
   - Configure webhook for email delivery failures
   - Store delivery status in database
   - Alert on high bounce/complaint rates
   - Email delivery failure alert (SendGrid webhook)
   - Database trigger on notification table anomalies

4. **Health Check Endpoint**
   - `/api/health/notifications` - Returns last successful email time
   - `/api/health/cron` - Returns pg_cron job status
   - Monitor with UptimeRobot or similar
