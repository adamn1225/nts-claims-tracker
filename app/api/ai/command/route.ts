/**
 * POST /api/ai/command
 *
 * AI-powered natural language command system for lead distribution and task management.
 * Admins/managers can type commands like "Give David R 100 random truck dealers to call"
 * and the AI will parse + execute the action.
 *
 * Request body:
 *   command   string  — Natural language command
 *
 * Response:
 *   {
 *     understood: boolean,
 *     action: 'distribute' | 'create_tasks' | 'reassign' | 'filter',
 *     parameters: object,
 *     preview: string[],  // Preview of what will happen
 *     executed: boolean,
 *     confirmation?: string
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type CommandAction = "distribute" | "create_tasks" | "reassign" | "filter" | "revert" | "unknown";

type ParsedCommand = {
  action: CommandAction;
  broker_name?: string;
  broker_id?: string;
  quantity?: number;
  filters?: {
    industry?: string;
    state?: string;
    source?: string;
    status?: string;
    shipping_frequency?: string;
  };
  task_type?: "call" | "follow_up";
  distribution_method?: "random" | "even" | "prioritized";
  confidence: "high" | "medium" | "low";
};

type RevertData = {
  customer_ids: string[];
  previous_broker_ids: (string | null)[];
  task_ids?: string[];
};

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin/manager
  const { data: broker } = await supabase
    .from("brokers")
    .select("is_admin, is_manager, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!broker?.is_admin && !broker?.is_manager) {
    return NextResponse.json({ error: "Admin/Manager access required" }, { status: 403 });
  }

  let command: string;
  let execute: boolean = false;
  let revertData: RevertData | null = null;
  try {
    const body = await request.json();
    command = body.command;
    execute = body.execute || false;
    revertData = body.revertData || null;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!command && !revertData) {
    return NextResponse.json({ error: "command or revertData is required" }, { status: 400 });
  }

  try {
    // Handle revert request (no AI parsing needed)
    if (revertData) {
      const { customer_ids, previous_broker_ids, task_ids } = revertData;

      // Restore previous broker assignments
      if (customer_ids && previous_broker_ids && customer_ids.length === previous_broker_ids.length) {
        for (let i = 0; i < customer_ids.length; i++) {
          const { error } = await supabase
            .from("customers")
            .update({ 
              broker_id: previous_broker_ids[i], 
              updated_at: new Date().toISOString() 
            })
            .eq("id", customer_ids[i]);

          if (error) throw error;
        }
      }

      // Delete created tasks if any
      if (task_ids && task_ids.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .in("id", task_ids);

        if (error) throw error;
      }

      return NextResponse.json({
        understood: true,
        action: "revert",
        executed: true,
        confirmation: `✅ Successfully reverted last command: ${customer_ids.length} customers restored${task_ids ? `, ${task_ids.length} tasks deleted` : ""}`,
      });
    }

    // Step 1: Get all active brokers with customer counts for better context
    const { data: allBrokers } = await supabase
      .from("broker_customer_summary")
      .select("broker_id, first_name, last_name, full_name, email, office_location, total_customers, active_customers, prospects, is_admin, is_manager")
      .order("last_name");

    // Step 2: Use AI to parse the command
    const parseCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a command parser for a freight broker CRM system.
Parse natural language commands into structured actions.

Available actions:
- distribute: Assign contacts/leads to a broker
- create_tasks: Create follow-up tasks for contacts
- reassign: Move contacts from one broker to another
- filter: Search/filter contacts (read-only)

Available brokers:
${allBrokers?.map(b => 
  `- ${b.full_name} (${b.email}, ${b.office_location}, ${b.total_customers || 0} customers, ${b.active_customers || 0} active)`
).join('\n')}

IMPORTANT: When parsing broker names:
- Match on first name, last name, or full name
- Use last initial if provided (e.g., "David R" = first_name + last_name starts with R)
- Use office location if specified (e.g., "David from Dallas")
- If ambiguous, include the clarification in your response confidence level

Extract:
1. Action type
2. Broker name (if mentioned)
3. Quantity (number of contacts)
4. Filters (industry, state, source, status, shipping_frequency)
5. Task type (call, follow_up)
6. Distribution method (random, even, prioritized)

Return ONLY valid JSON with this exact structure:
{
  "action": "distribute" | "create_tasks" | "reassign" | "filter" | "unknown",
  "broker_name": "string or null",
  "quantity": number or null,
  "filters": {
    "industry": "string or null",
    "state": "string or null",
    "source": "string or null",
    "status": "string or null",
    "shipping_frequency": "string or null"
  },
  "task_type": "call" | "follow_up" | null,
  "distribution_method": "random" | "even" | "prioritized" | null,
  "confidence": "high" | "medium" | "low"
}`,
        },
        {
          role: "user",
          content: command,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed: ParsedCommand = JSON.parse(parseCompletion.choices[0].message.content || "{}");

    // Step 3: Enhanced broker name resolution with disambiguation
    if (parsed.broker_name && allBrokers) {
      const searchTerm = parsed.broker_name.toLowerCase().trim();
      
      // Try exact full name match first
      let matchedBroker = allBrokers.find(b => 
        b.full_name?.toLowerCase() === searchTerm
      );

      // Try first name + last initial (e.g., "David R")
      if (!matchedBroker && searchTerm.includes(' ')) {
        const parts = searchTerm.split(' ');
        if (parts.length === 2 && parts[1].length === 1) {
          // Format: "David R"
          matchedBroker = allBrokers.find(b => 
            b.first_name?.toLowerCase() === parts[0] &&
            b.last_name?.toLowerCase().startsWith(parts[1])
          );
        } else {
          // Try first + last name combination
          matchedBroker = allBrokers.find(b => 
            b.full_name?.toLowerCase().includes(searchTerm)
          );
        }
      }

      // Try first name only (but check for duplicates)
      if (!matchedBroker) {
        const firstNameMatches = allBrokers.filter(b => 
          b.first_name?.toLowerCase() === searchTerm
        );
        
        if (firstNameMatches.length === 1) {
          matchedBroker = firstNameMatches[0];
        } else if (firstNameMatches.length > 1) {
          // Multiple brokers with same first name - need disambiguation
          return NextResponse.json({
            understood: true,
            action: parsed.action,
            parameters: parsed,
            preview: [],
            executed: false,
            error: `Multiple brokers named "${parsed.broker_name}" found. Please specify:\n${
              firstNameMatches.map(b => `  • ${b.full_name} (${b.office_location})`).join('\n')
            }\n\nTry: "${parsed.broker_name} ${firstNameMatches[0].last_name}" or "${parsed.broker_name} from ${firstNameMatches[0].office_location}"`,
          });
        }
      }

      // Partial match as last resort
      if (!matchedBroker) {
        matchedBroker = allBrokers.find(b => 
          b.first_name?.toLowerCase().includes(searchTerm) ||
          b.last_name?.toLowerCase().includes(searchTerm)
        );
      }

      if (matchedBroker) {
        parsed.broker_id = matchedBroker.broker_id;
      } else {
        return NextResponse.json({
          understood: false,
          action: parsed.action,
          parameters: parsed,
          preview: [],
          executed: false,
          error: `Could not find broker "${parsed.broker_name}". Available brokers:\n${
            allBrokers.slice(0, 10).map(b => `  • ${b.full_name} (${b.office_location})`).join('\n')
          }`,
        });
      }
    }

    // Step 4: Build query based on filters
    let contactsQuery = supabase.from("customers").select("id, business_name, contact_name, state, industry, broker_id");

    // Apply filters
    if (parsed.filters?.industry) {
      contactsQuery = contactsQuery.ilike("industry", `%${parsed.filters.industry}%`);
    }
    if (parsed.filters?.state) {
      contactsQuery = contactsQuery.eq("state", parsed.filters.state.toUpperCase());
    }
    if (parsed.filters?.source) {
      contactsQuery = contactsQuery.eq("import_source", parsed.filters.source);
    }
    if (parsed.filters?.status) {
      contactsQuery = contactsQuery.eq("status", parsed.filters.status);
    }
    if (parsed.filters?.shipping_frequency) {
      contactsQuery = contactsQuery.eq("shipping_frequency", parsed.filters.shipping_frequency);
    }

    // For distribution, get unassigned contacts
    if (parsed.action === "distribute") {
      contactsQuery = contactsQuery.is("broker_id", null);
    }

    const { data: matchingContacts, error: contactsError } = await contactsQuery;

    if (contactsError) throw contactsError;

    if (!matchingContacts || matchingContacts.length === 0) {
      return NextResponse.json({
        understood: true,
        action: parsed.action,
        parameters: parsed,
        preview: [],
        executed: false,
        message: "No contacts match the specified criteria",
      });
    }

    // Step 5: Apply quantity limit and distribution method
    let selectedContacts = matchingContacts;

    if (parsed.quantity && parsed.quantity < matchingContacts.length) {
      if (parsed.distribution_method === "random") {
        selectedContacts = matchingContacts.sort(() => Math.random() - 0.5).slice(0, parsed.quantity);
      } else {
        selectedContacts = matchingContacts.slice(0, parsed.quantity);
      }
    }

    // Step 6: Generate preview with broker context
    const selectedBroker = parsed.broker_id ? allBrokers?.find(b => b.broker_id === parsed.broker_id) : null;
    const preview = selectedContacts.slice(0, 10).map(c => 
      `${c.business_name || c.contact_name || "Unknown"} (${c.state || "?"}${c.industry ? ` - ${c.industry}` : ""})`
    );

    if (selectedContacts.length > 10) {
      preview.push(`...and ${selectedContacts.length - 10} more`);
    }

    // Add broker context to preview
    if (selectedBroker) {
      preview.unshift(`📌 Target Broker: ${selectedBroker.full_name} (${selectedBroker.office_location}, ${selectedBroker.active_customers || 0} active customers)`);
    }

    // Step 7: Execute if requested
    if (execute) {
      const contactIds = selectedContacts.map(c => c.id);
      const previousBrokerIds = selectedContacts.map(c => c.broker_id);

      if (parsed.action === "distribute" && parsed.broker_id) {
        // Assign contacts to broker
        const { error: assignError } = await supabase
          .from("customers")
          .update({ broker_id: parsed.broker_id, updated_at: new Date().toISOString() })
          .in("id", contactIds);

        if (assignError) throw assignError;

        let createdTaskIds: string[] = [];

        // Create tasks if requested
        if (parsed.task_type) {
          const tasks = contactIds.map(customerId => ({
            broker_id: parsed.broker_id,
            customer_id: customerId,
            title: parsed.task_type === "call" ? "Initial Contact Call" : "Follow-up",
            type: parsed.task_type,
            priority: "normal",
            status: "pending",
            due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
          }));

          const { data: createdTasks, error: tasksError } = await supabase
            .from("tasks")
            .insert(tasks)
            .select("id");

          if (tasksError) throw tasksError;
          createdTaskIds = createdTasks?.map(t => t.id) || [];
        }

        const brokerFullName = allBrokers?.find(b => b.broker_id === parsed.broker_id);
        return NextResponse.json({
          understood: true,
          action: parsed.action,
          parameters: parsed,
          preview,
          executed: true,
          confirmation: `✅ Assigned ${contactIds.length} contacts to ${brokerFullName?.full_name}${parsed.task_type ? ` and created ${contactIds.length} ${parsed.task_type} tasks` : ""}`,
          brokerInfo: selectedBroker ? {
            name: selectedBroker.full_name || "Unknown",
            office: selectedBroker.office_location || "N/A",
            activeCustomers: selectedBroker.active_customers || 0,
          } : undefined,
          contactsDistributed: selectedContacts.map(c => ({
            name: c.business_name || c.contact_name || "Unknown",
            state: c.state || "?",
            industry: c.industry || undefined,
          })),
          revertData: {
            customer_ids: contactIds,
            previous_broker_ids: previousBrokerIds,
            task_ids: createdTaskIds.length > 0 ? createdTaskIds : undefined,
          },
        });
      }

      if (parsed.action === "create_tasks" && parsed.broker_id) {
        // Create tasks for existing broker's customers
        const tasks = contactIds.map(customerId => ({
          broker_id: parsed.broker_id,
          customer_id: customerId,
          title: parsed.task_type === "call" ? "Follow-up Call" : "Follow-up",
          type: parsed.task_type || "follow_up",
          priority: "normal",
          status: "pending",
          due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        }));

        const { data: createdTasks, error: tasksError } = await supabase
          .from("tasks")
          .insert(tasks)
          .select("id");

        if (tasksError) throw tasksError;
        const createdTaskIds = createdTasks?.map(t => t.id) || [];

        return NextResponse.json({
          understood: true,
          action: parsed.action,
          parameters: parsed,
          preview,
          executed: true,
          confirmation: `✅ Created ${tasks.length} ${parsed.task_type || "follow-up"} tasks`,
          brokerInfo: selectedBroker ? {
            name: selectedBroker.full_name || "Unknown",
            office: selectedBroker.office_location || "N/A",
            activeCustomers: selectedBroker.active_customers || 0,
          } : undefined,
          contactsDistributed: selectedContacts.map(c => ({
            name: c.business_name || c.contact_name || "Unknown",
            state: c.state || "?",
            industry: c.industry || undefined,
          })),
          revertData: {
            customer_ids: contactIds,
            previous_broker_ids: previousBrokerIds,
            task_ids: createdTaskIds,
          },
        });
      }
    }

    // Return preview (not executed)
    return NextResponse.json({
      understood: true,
      action: parsed.action,
      parameters: parsed,
      preview,
      executed: false,
      message: `Preview: ${selectedContacts.length} contacts ready. Click "Execute" to confirm.`,
      brokerInfo: selectedBroker ? {
        name: selectedBroker.full_name || "Unknown",
        office: selectedBroker.office_location || "N/A",
        activeCustomers: selectedBroker.active_customers || 0,
      } : undefined,
    });

  } catch (error: any) {
    console.error("AI Command error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process command" },
      { status: 500 }
    );
  }
}
