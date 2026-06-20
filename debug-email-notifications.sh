#!/bin/bash
# Email Notification Debugging Script
# Tests all components of the email notification system

echo "========================================="
echo "EMAIL NOTIFICATION SYSTEM DIAGNOSTICS"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

echo "1. CHECKING ENVIRONMENT VARIABLES"
echo "-----------------------------------"
if [ -n "$SENDGRID_API_KEY" ]; then
  echo -e "${GREEN}✓${NC} SENDGRID_API_KEY is set (length: ${#SENDGRID_API_KEY})"
else
  echo -e "${RED}✗${NC} SENDGRID_API_KEY is NOT set"
fi

if [ -n "$SENDGRID_FROM_EMAIL" ]; then
  echo -e "${GREEN}✓${NC} SENDGRID_FROM_EMAIL: $SENDGRID_FROM_EMAIL"
else
  echo -e "${RED}✗${NC} SENDGRID_FROM_EMAIL is NOT set"
fi

if [ -n "$NEXT_PUBLIC_APP_URL" ]; then
  echo -e "${GREEN}✓${NC} NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL"
else
  echo -e "${YELLOW}⚠${NC} NEXT_PUBLIC_APP_URL not set (will use localhost)"
fi

echo ""
echo "2. TESTING API ENDPOINT (Manual Trigger)"
echo "----------------------------------------"
echo "Testing /api/cron/send-task-reminders..."

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cron/send-task-reminders 2>&1)

if [ "$RESPONSE" = "200" ]; then
  echo -e "${GREEN}✓${NC} Endpoint is accessible (HTTP 200)"
  echo ""
  echo "Full response:"
  curl -s http://localhost:3000/api/cron/send-task-reminders | jq '.' || curl -s http://localhost:3000/api/cron/send-task-reminders
else
  echo -e "${RED}✗${NC} Endpoint returned HTTP $RESPONSE"
  echo "Make sure the development server is running (npm run dev)"
fi

echo ""
echo "3. CHECKING USER SETTINGS"
echo "-------------------------"
echo "Checking your email notification preferences..."

# Query using Supabase CLI
npx supabase db execute -c "
SELECT 
  b.email,
  b.first_name,
  b.last_name,
  up.email_notifications_enabled,
  up.digest_time,
  up.last_digest_sent_date
FROM brokers b
LEFT JOIN user_preferences up ON up.broker_id = b.id
WHERE b.id = '1e8357cd-5268-4ac3-98f8-2dc42b9b69ee'
" 2>/dev/null || echo -e "${YELLOW}⚠${NC} Unable to query database (Supabase CLI not connected)"

echo ""
echo "4. CHECKING ACTIVE TASKS WITH REMINDERS"
echo "----------------------------------------"
echo "Looking for tasks that should trigger email reminders..."

npx supabase db execute -c "
SELECT 
  t.title,
  t.due_date,
  t.due_time,
  t.status,
  t.reminder_days,
  t.last_reminder_sent_date,
  b.email as broker_email
FROM tasks t
LEFT JOIN brokers b ON b.id = t.broker_id
WHERE t.status = 'pending'
  AND t.due_time IS NOT NULL
  AND t.reminder_days IS NOT NULL
  AND array_length(t.reminder_days, 1) > 0
LIMIT 5
" 2>/dev/null || echo -e "${YELLOW}⚠${NC} Unable to query database"

echo ""
echo "5. CHECKING CRON JOB STATUS"
echo "----------------------------"
echo "Checking pg_cron job registration..."

npx supabase db execute -c "
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname LIKE '%task%' OR jobname LIKE '%digest%'
ORDER BY jobname
" 2>/dev/null || echo -e "${YELLOW}⚠${NC} Unable to query cron jobs"

echo ""
echo "6. CHECKING RECENT CRON EXECUTIONS"
echo "-----------------------------------"
echo "Last 5 cron job runs..."

npx supabase db execute -c "
SELECT 
  j.jobname,
  r.start_time,
  r.status,
  r.return_message
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
WHERE j.jobname LIKE '%task%' OR j.jobname LIKE '%digest%'
ORDER BY r.start_time DESC
LIMIT 5
" 2>/dev/null || echo -e "${YELLOW}⚠${NC} Unable to query cron run history"

echo ""
echo "========================================="
echo "DEBUGGING COMPLETE"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. If endpoint test failed: Start dev server with 'npm run dev'"
echo "2. If email_notifications_enabled = false: Enable in Settings"
echo "3. If no tasks with reminders: Create a test task with reminders"
echo "4. If cron jobs not active: Check Supabase dashboard"
echo "5. Check SendGrid dashboard for delivery status"
echo ""
