/**
 * Microsoft Graph API Integration
 * 
 * Provides optional integration with:
 * - Outlook Calendar (sync tasks as calendar events)
 * - Microsoft Teams (generate meeting links)
 * 
 * This is OPTIONAL - brokers can choose to connect or not.
 */

import { createClient } from '@/lib/supabase/client';

// Microsoft Graph API base URL
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Required OAuth scopes for our integrations
export const REQUIRED_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',              // To get refresh tokens
  'Calendars.ReadWrite',          // Create/update calendar events
  'OnlineMeetings.ReadWrite',     // Create Teams meeting links
].join(' ');

interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
}

/**
 * Check if user has Microsoft integration enabled and tokens available
 */
export async function isMicrosoftConnected(brokerId: string): Promise<boolean> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('microsoft_tokens')
    .select('id, expires_at')
    .eq('broker_id', brokerId)
    .single();
  
  if (error || !data) return false;
  
  // Check if token is still valid (or can be refreshed)
  return true;
}

/**
 * Get valid access token for user (refreshes if needed)
 */
async function getValidAccessToken(brokerId: string): Promise<string | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('microsoft_tokens')
    .select('*')
    .eq('broker_id', brokerId)
    .single();
  
  if (error || !data) return null;
  
  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  
  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(brokerId, data.refresh_token);
    return refreshed?.access_token || null;
  }
  
  return data.access_token;
}

/**
 * Refresh an expired access token
 */
async function refreshAccessToken(brokerId: string, refreshToken: string): Promise<MicrosoftTokens | null> {
  try {
    // This will be implemented once we have Azure credentials
    // For now, return null to gracefully handle missing implementation
    console.log('Token refresh not yet configured - Azure credentials needed');
    return null;
  } catch (error) {
    console.error('Error refreshing Microsoft token:', error);
    return null;
  }
}

/**
 * Create or update a calendar event in Outlook
 */
export async function syncTaskToOutlookCalendar(
  brokerId: string,
  task: {
    title: string;
    description?: string;
    due_date: string;
    due_time?: string | null;
    customer_name?: string;
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(brokerId);
    if (!accessToken) {
      return { success: false, error: 'Microsoft account not connected' };
    }
    
    // Parse date and time
    const dueDate = new Date(task.due_date);
    let startDateTime = new Date(dueDate);
    let endDateTime = new Date(dueDate);
    
    if (task.due_time) {
      const [hours, minutes] = task.due_time.split(':').map(Number);
      startDateTime.setHours(hours, minutes, 0);
      endDateTime.setHours(hours + 1, minutes, 0); // 1 hour duration
    } else {
      // All-day event
      startDateTime.setHours(9, 0, 0);
      endDateTime.setHours(10, 0, 0);
    }
    
    const event = {
      subject: task.customer_name 
        ? `${task.title} - ${task.customer_name}`
        : task.title,
      body: {
        contentType: 'text',
        content: task.description || `Task: ${task.title}`,
      },
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'UTC',
      },
      isAllDay: !task.due_time,
      categories: ['NTS Claims Tracker'],
      showAs: 'busy',
    };
    
    const response = await fetch(`${GRAPH_API_BASE}/me/calendar/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error creating calendar event:', error);
      return { success: false, error: error.error?.message || 'Failed to create event' };
    }
    
    const created = await response.json();
    return { success: true, eventId: created.id };
  } catch (error: any) {
    console.error('Error syncing to Outlook:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a Microsoft Teams meeting link
 */
export async function generateTeamsMeetingLink(
  brokerId: string,
  meeting: {
    title: string;
    start_time: string;
    end_time: string;
    customer_name?: string;
  }
): Promise<{ success: boolean; joinUrl?: string; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(brokerId);
    if (!accessToken) {
      return { success: false, error: 'Microsoft account not connected' };
    }
    
    const onlineMeeting = {
      startDateTime: meeting.start_time,
      endDateTime: meeting.end_time,
      subject: meeting.customer_name 
        ? `${meeting.title} with ${meeting.customer_name}`
        : meeting.title,
    };
    
    const response = await fetch(`${GRAPH_API_BASE}/me/onlineMeetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(onlineMeeting),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error creating Teams meeting:', error);
      return { success: false, error: error.error?.message || 'Failed to create meeting' };
    }
    
    const created = await response.json();
    return { success: true, joinUrl: created.joinUrl };
  } catch (error: any) {
    console.error('Error creating Teams meeting:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete calendar event from Outlook
 */
export async function deleteOutlookCalendarEvent(
  brokerId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(brokerId);
    if (!accessToken) {
      return { success: false, error: 'Microsoft account not connected' };
    }
    
    const response = await fetch(`${GRAPH_API_BASE}/me/calendar/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok && response.status !== 404) {
      return { success: false, error: 'Failed to delete event' };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting calendar event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Disconnect Microsoft account and delete stored tokens
 */
export async function disconnectMicrosoftAccount(brokerId: string): Promise<{ success: boolean }> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('microsoft_tokens')
    .delete()
    .eq('broker_id', brokerId);
  
  if (error) {
    console.error('Error disconnecting Microsoft account:', error);
    return { success: false };
  }
  
  return { success: true };
}
