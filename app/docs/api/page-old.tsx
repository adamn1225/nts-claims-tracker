"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Book, Code, Key, Lock, Zap, CheckCircle2, Copy, Check, ShieldCheck, Database,
  Play, Menu, X, ChevronRight, AlertCircle, Loader2
} from "lucide-react";

export default function ApiDocsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  // Check admin access
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user || error) {
          router.push("/auth/login");
          return;
        }
        // Check if user is admin via brokers table
        const { data: broker, error: brokerError } = await supabase
          .from("brokers")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        setIsAdmin(Boolean(broker?.is_admin));
        if (brokerError) console.warn("Broker lookup error", brokerError.message);
      } finally {
        setLoading(false);
      }
    };
    checkAccess();
  }, [router, supabase]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Checking access…
      </div>
    );
  }

  // Unauthorized state
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900">
          Admin access required
        </h1>
        <p className="mb-4 text-slate-600">
          API documentation is restricted to administrators only.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Book className="h-8 w-8 text-orange-500" />
            NTS Claims Tracker API Documentation
          </h1>
          <p className="mt-2 text-slate-600">
            RESTful API for managing customers, tasks, and contacts programmatically
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Quick Start
          </h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-medium text-slate-900">1. Create an API Token</h3>
              <p className="text-sm text-slate-600">
                Navigate to admin dashboard → API Tokens tab → Create Token
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-medium text-slate-900">2. Make Your First Request</h3>
              <CodeBlock
                id="quickstart"
                code={`curl -X GET "${baseUrl}/api/v1/customers" \\
  -H "Authorization: Bearer YOUR_API_TOKEN"`}
                onCopy={copyCode}
                copied={copiedCode === "quickstart"}
              />
            </div>

            <div>
              <h3 className="mb-2 font-medium text-slate-900">3. Handle the Response</h3>
              <CodeBlock
                id="response"
                language="json"
                code={`{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 250,
    "totalPages": 3
  }
}`}
                onCopy={copyCode}
                copied={copiedCode === "response"}
              />
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-500" />
            Authentication
          </h2>
          
          <p className="mb-4 text-sm text-slate-600">
            Include your API token in the <code className="rounded bg-slate-100 px-1">Authorization</code> header:
          </p>
          
          <CodeBlock
            id="auth"
            code={`Authorization: Bearer nts_live_your_token_here`}
            onCopy={copyCode}
            copied={copiedCode === "auth"}
          />

          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-sm text-orange-900">
              <strong>Security:</strong> Never share your API tokens or commit them to version control.
              Store them as environment variables.
            </p>
          </div>
        </section>

        {/* Rate Limiting */}
        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Rate Limiting</h2>
          
          <p className="mb-4 text-sm text-slate-600">
            All API requests include rate limit headers:
          </p>
          
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <code>X-RateLimit-Limit</code>: Your hourly request limit
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <code>X-RateLimit-Remaining</code>: Requests remaining in current window
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <code>X-RateLimit-Reset</code>: When the limit resets (ISO 8601 timestamp)
            </li>
          </ul>
        </section>

        {/* Object Schemas */}
        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Database className="h-5 w-5 text-orange-500" />
            Object Schemas
          </h2>
          
          <p className="mb-6 text-sm text-slate-600">
            Complete field reference for all API objects.
          </p>

          {/* Customer Object */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Customer Object</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Field</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-3 py-2 font-mono text-xs">id</td><td className="px-3 py-2 text-slate-600">string (uuid)</td><td className="px-3 py-2 text-slate-600">Unique identifier</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">customer_id</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Human-readable ID (e.g., NS-0001)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">broker_id</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Assigned broker (null = unassigned)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">first_name</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Contact first name</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">last_name</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Contact last name</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">contact_name</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Full contact name (required)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">business_name</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Company/business name (required)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">email</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Email address</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">phone</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Phone number</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">address</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Street address</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">city</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">City</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">state</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">State/Province code</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">zip</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">ZIP/Postal code</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">status</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Current status (active, prospect, won, lost, etc.)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">industry</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Industry category</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">shipping_frequency</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">How often they ship (weekly, monthly, etc.)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">opportunity_type</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Type of opportunity (New Call In, Cold Call, etc.)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">estimated_value</td><td className="px-3 py-2 text-slate-600">number | null</td><td className="px-3 py-2 text-slate-600">Estimated annual value in dollars</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">notes</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Internal notes</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">website_url</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Company website</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">linkedin_url</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">LinkedIn profile</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">facebook_url</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Facebook page</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">instagram_url</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Instagram profile</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">twitter_url</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Twitter/X profile</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">tms_account_id</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">TMS system account ID</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">office_location</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Office/territory location</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">on_kanban_board</td><td className="px-3 py-2 text-slate-600">boolean | null</td><td className="px-3 py-2 text-slate-600">Whether shown on kanban board</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">is_pinned</td><td className="px-3 py-2 text-slate-600">boolean | null</td><td className="px-3 py-2 text-slate-600">Whether pinned to top</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">pin_order</td><td className="px-3 py-2 text-slate-600">number | null</td><td className="px-3 py-2 text-slate-600">Pin position order</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">last_contact_date</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Last contact date (ISO 8601)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">next_follow_up_date</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Next follow-up date (ISO 8601)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">next_follow_up_type</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Type of next follow-up</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">import_source</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Source of import (CSV, API, etc.)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">import_metadata</td><td className="px-3 py-2 text-slate-600">JSON | null</td><td className="px-3 py-2 text-slate-600">Additional import metadata</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">imported_by</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Broker who imported</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">created_at</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Creation timestamp (ISO 8601)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">updated_at</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Last update timestamp (ISO 8601)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Task Object */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Task Object</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Field</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-3 py-2 font-mono text-xs">id</td><td className="px-3 py-2 text-slate-600">string (uuid)</td><td className="px-3 py-2 text-slate-600">Unique identifier</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">broker_id</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Assigned broker</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">customer_id</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Related customer ID</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">title</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Task title (required)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">description</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Task description/notes</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">type</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Task type (follow_up, call, email, meeting, etc.)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">status</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Current status (pending, completed, overdue, cancelled)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">priority</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Priority level (critical, urgent, high, medium, low)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">due_date</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Due date (ISO 8601 date format, required)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">due_time</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Due time (HH:MM format)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">reminder_days</td><td className="px-3 py-2 text-slate-600">number[] | null</td><td className="px-3 py-2 text-slate-600">Days before due date to send reminders</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">reminder_sent</td><td className="px-3 py-2 text-slate-600">boolean | null</td><td className="px-3 py-2 text-slate-600">Whether reminder was sent</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">reminder_sent_at</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">When reminder was sent (ISO 8601)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">last_reminder_sent_date</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Last reminder date (ISO 8601)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">completed_at</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Completion timestamp (ISO 8601)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">completion_outcome</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Task outcome (successful, unsuccessful, etc.)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">completion_notes</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">Notes about task completion</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">follow_up_task_id</td><td className="px-3 py-2 text-slate-600">string | null</td><td className="px-3 py-2 text-slate-600">ID of follow-up task created</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">created_at</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Creation timestamp (ISO 8601)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">updated_at</td><td className="px-3 py-2 text-slate-600">string</td><td className="px-3 py-2 text-slate-600">Last update timestamp (ISO 8601)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Unassigned Contact Note */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 font-semibold text-blue-900">Unassigned Contacts</h3>
            <p className="text-sm text-blue-800">
              Unassigned contacts use the same <strong>Customer Object</strong> schema above, but with <code className="rounded bg-blue-100 px-1">broker_id</code> set to <code className="rounded bg-blue-100 px-1">null</code>.
              These represent contacts in the import pool waiting to be assigned to brokers.
            </p>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mb-8 space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">API Endpoints</h2>
          
          {/* Customers */}
          <EndpointSection
            title="Customers"
            baseUrl={baseUrl}
            endpoints={[
              {
                method: "GET",
                path: "/api/v1/customers",
                description: "List all customers",
                params: ["page", "limit", "status", "city", "state", "industry", "search"],
                scope: "customers:read",
              },
              {
                method: "GET",
                path: "/api/v1/customers/:id",
                description: "Get customer by ID",
                scope: "customers:read",
              },
              {
                method: "POST",
                path: "/api/v1/customers",
                description: "Create new customer",
                scope: "customers:create",
                body: { business_name: "Required", email: "Optional", phone: "Optional" },
              },
              {
                method: "PUT",
                path: "/api/v1/customers/:id",
                description: "Update customer",
                scope: "customers:write",
              },
              {
                method: "DELETE",
                path: "/api/v1/customers/:id",
                description: "Delete customer",
                scope: "customers:delete",
              },
            ]}
            copyCode={copyCode}
            copiedCode={copiedCode}
          />

          {/* Tasks */}
          <EndpointSection
            title="Tasks"
            baseUrl={baseUrl}
            endpoints={[
              {
                method: "GET",
                path: "/api/v1/tasks",
                description: "List all tasks",
                params: ["page", "limit", "status", "priority", "type", "customer_id", "due_after", "due_before"],
                scope: "tasks:read",
              },
              {
                method: "GET",
                path: "/api/v1/tasks/:id",
                description: "Get task by ID",
                scope: "tasks:read",
              },
              {
                method: "POST",
                path: "/api/v1/tasks",
                description: "Create new task",
                scope: "tasks:create",
                body: { title: "Required", due_date: "Required", priority: "Optional", customer_id: "Optional" },
              },
              {
                method: "PUT",
                path: "/api/v1/tasks/:id",
                description: "Update task",
                scope: "tasks:write",
              },
              {
                method: "DELETE",
                path: "/api/v1/tasks/:id",
                description: "Delete task",
                scope: "tasks:delete",
              },
            ]}
            copyCode={copyCode}
            copiedCode={copiedCode}
          />

          {/* Unassigned Contacts */}
          <EndpointSection
            title="Unassigned Contacts"
            baseUrl={baseUrl}
            endpoints={[
              {
                method: "GET",
                path: "/api/v1/unassigned_contacts",
                description: "List all unassigned contacts",
                params: ["page", "limit", "import_source", "city", "state", "industry", "search"],
                scope: "unassigned_contacts:read",
              },
              {
                method: "GET",
                path: "/api/v1/unassigned_contacts/:id",
                description: "Get unassigned contact by ID",
                scope: "unassigned_contacts:read",
              },
              {
                method: "POST",
                path: "/api/v1/unassigned_contacts",
                description: "Create/import unassigned contact",
                scope: "unassigned_contacts:create",
                body: { business_name: "Required", import_source: "Optional" },
              },
              {
                method: "PUT",
                path: "/api/v1/unassigned_contacts/:id",
                description: "Update unassigned contact (e.g., assign to broker)",
                scope: "unassigned_contacts:write",
              },
              {
                method: "DELETE",
                path: "/api/v1/unassigned_contacts/:id",
                description: "Delete unassigned contact",
                scope: "unassigned_contacts:delete",
              },
            ]}
            copyCode={copyCode}
            copiedCode={copiedCode}
          />
        </section>

        {/* Error Handling */}
        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Error Handling</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-medium text-slate-900">Error Response Format</h3>
              <CodeBlock
                id="error"
                language="json"
                code={`{
  "error": "Error message",
  "details": "Additional context (optional)"
}`}
                onCopy={copyCode}
                copied={copiedCode === "error"}
              />
            </div>

            <div>
              <h3 className="mb-2 font-medium text-slate-900">Common Status Codes</h3>
              <ul className="space-y-1 text-sm">
                <li><code>200</code> - Success</li>
                <li><code>201</code> - Created</li>
                <li><code>204</code> - No Content (successful deletion)</li>
                <li><code>400</code> - Bad Request (missing required fields)</li>
                <li><code>401</code> - Unauthorized (invalid token)</li>
                <li><code>403</code> - Forbidden (insufficient permissions)</li>
                <li><code>404</code> - Not Found</li>
                <li><code>429</code> - Rate Limit Exceeded</li>
                <li><code>500</code> - Internal Server Error</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SDKs & Examples */}
        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Code Examples</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 font-medium text-slate-900">JavaScript / Node.js</h3>
              <CodeBlock
                id="js-example"
                language="javascript"
                code={`const response = await fetch('${baseUrl}/api/v1/customers', {
  headers: {
    'Authorization': \`Bearer \${process.env.NTS_API_TOKEN}\`
  }
});

const { data, pagination } = await response.json();
console.log(\`Found \${pagination.total} customers\`);`}
                onCopy={copyCode}
                copied={copiedCode === "js-example"}
              />
            </div>

            <div>
              <h3 className="mb-2 font-medium text-slate-900">Python</h3>
              <CodeBlock
                id="python-example"
                language="python"
                code={`import requests
import os

response = requests.get(
    '${baseUrl}/api/v1/customers',
    headers={'Authorization': f'Bearer {os.environ["NTS_API_TOKEN"]}'}
)

data = response.json()
print(f"Found {data['pagination']['total']} customers")`}
                onCopy={copyCode}
                copied={copiedCode === "python-example"}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Code Block Component
function CodeBlock({
  id,
  code,
  language = "bash",
  onCopy,
  copied,
}: {
  id: string;
  code: string;
  language?: string;
  onCopy: (code: string, id: string) => void;
  copied: boolean;
}) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => onCopy(code, id)}
        className="absolute right-2 top-2 rounded p-1.5 hover:bg-slate-700"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4 text-slate-400" />
        )}
      </button>
    </div>
  );
}

// Endpoint Section Component
function EndpointSection({
  title,
  baseUrl,
  endpoints,
  copyCode,
  copiedCode,
}: {
  title: string;
  baseUrl: string;
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
    params?: string[];
    scope: string;
    body?: Record<string, string>;
  }>;
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">{title}</h3>
      
      <div className="space-y-4">
        {endpoints.map((endpoint, idx) => (
          <div key={idx} className="border-l-2 border-orange-500 pl-4">
            <div className="mb-2 flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                endpoint.method === "GET" ? "bg-blue-100 text-blue-700" :
                endpoint.method === "POST" ? "bg-green-100 text-green-700" :
                endpoint.method === "PUT" ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              }`}>
                {endpoint.method}
              </span>
              <code className="text-sm text-slate-900">{endpoint.path}</code>
              <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {endpoint.scope}
              </span>
            </div>
            
            <p className="mb-2 text-sm text-slate-600">{endpoint.description}</p>
            
            {endpoint.params && endpoint.params.length > 0 && (
              <div className="mb-2">
                <span className="text-xs font-medium text-slate-700">Query Params:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {endpoint.params.map((param) => (
                    <code key={param} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      ?{param}=...
                    </code>
                  ))}
                </div>
              </div>
            )}
            
            {endpoint.body && (
              <div className="mb-2">
                <span className="text-xs font-medium text-slate-700">Request Body:</span>
                <CodeBlock
                  id={`${endpoint.method}-${endpoint.path}-body`}
                  language="json"
                  code={JSON.stringify(endpoint.body, null, 2)}
                  onCopy={copyCode}
                  copied={copiedCode === `${endpoint.method}-${endpoint.path}-body`}
                />
              </div>
            )}
            
            <CodeBlock
              id={`${endpoint.method}-${endpoint.path}`}
              code={`curl -X ${endpoint.method} "${baseUrl}${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_API_TOKEN"${endpoint.body ? ' \\\n  -H "Content-Type: application/json" \\\n  -d \'' + JSON.stringify(endpoint.body) + '\'' : ''}`}
              onCopy={copyCode}
              copied={copiedCode === `${endpoint.method}-${endpoint.path}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
