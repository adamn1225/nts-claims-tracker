/**
 * Example: How to integrate Microsoft Graph with task creation
 * 
 * This file shows how to optionally sync tasks to Outlook Calendar
 * when users have Microsoft integration enabled.
 */

import { syncTaskToOutlookCalendar, isMicrosoftConnected } from '@/lib/microsoft-graph';
import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/lib/types';

/**
 * Create a task and optionally sync to Outlook Calendar
 * 
 * Usage in TaskFormModal or Sales Drill completion:
 */
export async function createTaskWithOptionalSync(
  taskData: Partial<Task>,
  teamMemberId: string,
  customerName?: string
): Promise<{ task: Task; calendarSynced: boolean; calendarError?: string }> {
  const supabase = createClient();
  
  // 1. Create the task in database (existing logic)
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      ...taskData,
      team_member_id: teamMemberId,
    })
    .select()
    .single();
  
  if (error || !task) {
    throw new Error(error?.message || 'Failed to create task');
  }
  
  // 2. Check if user has Microsoft integration enabled
  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('microsoft_integration_enabled')
    .eq('user_id', teamMemberId)
    .single();
  
  const integrationEnabled = preferences?.microsoft_integration_enabled ?? false;
  
  // 3. If enabled, try to sync to Outlook Calendar
  let calendarSynced = false;
  let calendarError: string | undefined;
  
  if (integrationEnabled) {
    const connected = await isMicrosoftConnected(teamMemberId);
    
    if (connected && task.due_date) {
      const syncResult = await syncTaskToOutlookCalendar(teamMemberId, {
        title: task.title,
        description: task.description || undefined,
        due_date: task.due_date,
        due_time: task.due_time,
        customer_name: customerName,
      });
      
      calendarSynced = syncResult.success;
      calendarError = syncResult.error;
      
      // Optionally store the calendar event ID for future updates/deletes
      if (syncResult.eventId) {
        await supabase
          .from('tasks')
          .update({ 
            // You may want to add a `calendar_event_id` column to tasks table
            // calendar_event_id: syncResult.eventId 
          })
          .eq('id', task.id);
      }
    }
  }
  
  return {
    task,
    calendarSynced,
    calendarError,
  };
}

/**
 * Example: Update existing implementation
 * 
 * In TaskFormModal.tsx handleSave():
 */
export const exampleTaskFormModalUsage = `
// Before:
const { data, error } = await supabase.from("tasks").insert({
  ...taskData,
  team_member_id: currentTeamMemberId,
}).select().single();

if (error || !data) throw error;

// After:
const result = await createTaskWithOptionalSync(
  taskData,
  currentTeamMemberId,
  customerName // Pass customer name if available
);

if (result.calendarSynced) {
  toast.success('Task created and synced to Outlook Calendar!');
} else if (result.calendarError) {
  toast.success('Task created');
  toast('Calendar sync failed - check Microsoft connection', { icon: '⚠️' });
}
`;

/**
 * Example: Sales Drill completion with follow-up task
 * 
 * In sales-drill/page.tsx when creating follow-up task after rescheduling:
 */
export const exampleSalesDrillUsage = `
// When creating follow-up task after "Rescheduled" outcome:
if (scheduleNext && currentTask.customer_id && nextTaskDate && nextTaskTitle.trim()) {
  const result = await createTaskWithOptionalSync(
    {
      title: nextTaskTitle.trim(),
      type: nextTaskType,
      customer_id: currentTask.customer_id,
      due_date: nextTaskDate,
      due_time: nextTaskTime || null,
      priority: nextTaskPriority,
      status: "pending" as TaskStatus,
      description: \`Scheduled from completed task: \${currentTask.title}\`,
    },
    viewingTeamMember?.id,
    currentTask.customer?.business_name
  );
  
  if (result.calendarSynced) {
    toast.success('Follow-up scheduled and added to your calendar!');
  }
}
`;

/**
 * Example: Generate Teams meeting link for online meetings
 * 
 * Add button to TaskFormModal for "online_meeting" type tasks:
 */
export const exampleTeamsMeetingUsage = `
import { generateTeamsMeetingLink } from '@/lib/microsoft-graph';

// Add button in TaskFormModal when task type is "online_meeting"
const handleGenerateTeamsMeeting = async () => {
  if (!dueDate || !dueTime) {
    toast.error('Please set a date and time first');
    return;
  }
  
  const startTime = new Date(\`\${dueDate}T\${dueTime}\`).toISOString();
  const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(); // +1 hour
  
  const result = await generateTeamsMeetingLink(teamMemberId, {
    title: taskTitle,
    start_time: startTime,
    end_time: endTime,
    customer_name: selectedCustomer?.business_name,
  });
  
  if (result.success && result.joinUrl) {
    // Add Teams link to task description
    setDescription((prev) => 
      \`\${prev}\\n\\nTeams Meeting: \${result.joinUrl}\`
    );
    toast.success('Teams meeting link generated!');
  } else {
    toast.error(result.error || 'Failed to generate Teams link');
  }
};

// In the form JSX:
{taskType === 'online_meeting' && (
  <button
    type="button"
    onClick={handleGenerateTeamsMeeting}
    className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
  >
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
    Generate Teams Meeting Link
  </button>
)}
`;
