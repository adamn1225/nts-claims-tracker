"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Book, Code, Key, Lock, Zap, CheckCircle2, Copy, Check, ShieldCheck, Database,
  Play, Menu, X, ChevronRight, AlertCircle, Loader2
} from "lucide-react";

// Navigation sections
const NAV_SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "quickstart", label: "Quick Start" },
  { id: "authentication", label: "Authentication" },
  { id: "playground", label: "API Playground" },
  { id: "schemas", label: "Object Schemas" },
  { id: "customers", label: "Customers API" },
  { id: "tasks", label: "Tasks API" },
  { id: "unassigned", label: "Unassigned Contacts API" },
  { id: "errors", label: "Error Handling" },
  { id: "examples", label: "Code Examples" },
];

export default function ApiDocsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -66%" }
    );

    NAV_SECTIONS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [isAdmin]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setSidebarOpen(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Unauthorized state
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="mx-auto max-w-md px-4 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <ShieldCheck className="h-8 w-8 text-orange-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Admin Access Required
          </h1>
          <p className="mb-6 text-slate-600">
            API documentation is restricted to administrators only.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-orange-600 px-6 py-2.5 font-medium text-white hover:bg-orange-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-slate-900">API Docs</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded p-1 hover:bg-slate-100"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-64 overflow-y-auto border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
        >
          <div className="p-6">
            <div className="mb-6 hidden lg:block">
              <div className="flex items-center gap-2">
                <Code className="h-6 w-6 text-orange-500" />
                <h1 className="text-lg font-bold text-slate-900">API Docs</h1>
              </div>
              <p className="mt-1 text-xs text-slate-500">NTS Claims Tracker</p>
            </div>

            <nav className="space-y-1">
              {NAV_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-orange-50 font-medium text-orange-600'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {section.label}
                  {activeSection === section.id && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-6 py-8 lg:px-12 lg:py-12">
          <div className="mx-auto max-w-4xl">
            {/* Introduction */}
            <section id="introduction" className="mb-16 scroll-mt-6">
              <h1 className="mb-3 text-4xl font-bold tracking-tight text-slate-900">
                API Documentation
              </h1>
              <p className="text-lg text-slate-600">
                RESTful API for managing customers, tasks, and contacts programmatically.
                Secure, scalable, and easy to integrate.
              </p>
            </section>

            {/* Quick Start */}
            <section id="quickstart" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Zap className="h-6 w-6 text-orange-500" />
                Quick Start
              </h2>
              
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                  <h3 className="mb-2 font-semibold text-slate-900">1. Create an API Token</h3>
                  <p className="text-sm text-slate-600">
                    Navigate to Admin Dashboard → API Tokens tab → Create Token
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                  <h3 className="mb-2 font-semibold text-slate-900">2. Make Your First Request</h3>
                  <CodeBlock
                    id="quickstart-curl"
                    code={`curl -X GET "${baseUrl}/api/v1/customers" \\
  -H "Authorization: Bearer YOUR_API_TOKEN"`}
                    onCopy={copyCode}
                    copied={copiedCode === "quickstart-curl"}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                  <h3 className="mb-2 font-semibold text-slate-900">3. Handle the Response</h3>
                  <CodeBlock
                    id="quickstart-response"
                    language="json"
                    code={`{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 250
  }
}`}
                    onCopy={copyCode}
                    copied={copiedCode === "quickstart-response"}
                  />
                </div>
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Lock className="h-6 w-6 text-orange-500" />
                Authentication
              </h2>

              <div className="space-y-4">
                <p className="text-slate-600">
                  All API requests must include your API token in the Authorization header:
                </p>

                <CodeBlock
                  id="auth-header"
                  code={`Authorization: Bearer nts_live_your_token_here`}
                  onCopy={copyCode}
                  copied={copiedCode === "auth-header"}
                />

                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-900">Security Best Practice</p>
                      <p className="mt-1 text-sm text-orange-800">
                        Never share your API tokens or commit them to version control.
                        Store them as environment variables.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="mb-2 font-semibold text-slate-900">Rate Limits</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <code className="text-xs">X-RateLimit-Limit</code>: Your hourly request limit
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <code className="text-xs">X-RateLimit-Remaining</code>: Requests remaining
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <code className="text-xs">X-RateLimit-Reset</code>: When the limit resets
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* API Playground */}
            <section id="playground" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Play className="h-6 w-6 text-orange-500" />
                API Playground
              </h2>
              <p className="mb-6 text-slate-600">
                Test API endpoints directly in your browser. No cost - it's just making requests to your own API.
              </p>
              
              <ApiPlayground baseUrl={baseUrl} />
            </section>

            {/* Object Schemas */}
            <section id="schemas" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Database className="h-6 w-6 text-orange-500" />
                Object Schemas
              </h2>
              
              <ObjectSchemas />
            </section>

            {/* Customers API */}
            <section id="customers" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Customers API</h2>
              <EndpointGroup
                title="Customer Endpoints"
                baseUrl={baseUrl}
                endpoints={[
                  {
                    method: "GET",
                    path: "/api/v1/customers",
                    description: "List all customers with pagination and filtering",
                    params: ["page", "limit", "status", "city", "state", "industry", "search"],
                    scope: "customers:read",
                  },
                  {
                    method: "GET",
                    path: "/api/v1/customers/:id",
                    description: "Get a single customer by ID",
                    scope: "customers:read",
                  },
                  {
                    method: "POST",
                    path: "/api/v1/customers",
                    description: "Create a new customer",
                    scope: "customers:create",
                    body: { business_name: "string (required)", contact_name: "string (required)", email: "string (optional)" },
                  },
                  {
                    method: "PUT",
                    path: "/api/v1/customers/:id",
                    description: "Update an existing customer",
                    scope: "customers:write",
                  },
                  {
                    method: "DELETE",
                    path: "/api/v1/customers/:id",
                    description: "Delete a customer",
                    scope: "customers:delete",
                  },
                ]}
                copyCode={copyCode}
                copiedCode={copiedCode}
              />
            </section>

            {/* Tasks API */}
            <section id="tasks" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Tasks API</h2>
              <EndpointGroup
                title="Task Endpoints"
                baseUrl={baseUrl}
                endpoints={[
                  {
                    method: "GET",
                    path: "/api/v1/tasks",
                    description: "List all tasks with filtering",
                    params: ["page", "limit", "status", "priority", "customer_id", "due_after", "due_before"],
                    scope: "tasks:read",
                  },
                  {
                    method: "GET",
                    path: "/api/v1/tasks/:id",
                    description: "Get a single task by ID",
                    scope: "tasks:read",
                  },
                  {
                    method: "POST",
                    path: "/api/v1/tasks",
                    description: "Create a new task",
                    scope: "tasks:create",
                    body: { title: "string (required)", due_date: "string (required)", type: "string (required)" },
                  },
                  {
                    method: "PUT",
                    path: "/api/v1/tasks/:id",
                    description: "Update an existing task",
                    scope: "tasks:write",
                  },
                  {
                    method: "DELETE",
                    path: "/api/v1/tasks/:id",
                    description: "Delete a task",
                    scope: "tasks:delete",
                  },
                ]}
                copyCode={copyCode}
                copiedCode={copiedCode}
              />
            </section>

            {/* Unassigned Contacts API */}
            <section id="unassigned" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Unassigned Contacts API</h2>
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Unassigned contacts use the same Customer schema but with <code className="rounded bg-blue-100 px-1">broker_id = null</code>.
                  These are contacts in the import pool awaiting assignment.
                </p>
              </div>
              <EndpointGroup
                title="Unassigned Contact Endpoints"
                baseUrl={baseUrl}
                endpoints={[
                  {
                    method: "GET",
                    path: "/api/v1/unassigned_contacts",
                    description: "List all unassigned contacts from the import pool",
                    params: ["page", "limit", "import_source", "city", "state", "search"],
                    scope: "unassigned_contacts:read",
                  },
                  {
                    method: "POST",
                    path: "/api/v1/unassigned_contacts",
                    description: "Add a new contact to the import pool",
                    scope: "unassigned_contacts:create",
                    body: { business_name: "string (required)", import_source: "string (optional)" },
                  },
                  {
                    method: "PUT",
                    path: "/api/v1/unassigned_contacts/:id",
                    description: "Update or assign an unassigned contact",
                    scope: "unassigned_contacts:write",
                  },
                  {
                    method: "DELETE",
                    path: "/api/v1/unassigned_contacts/:id",
                    description: "Delete an unassigned contact",
                    scope: "unassigned_contacts:delete",
                  },
                ]}
                copyCode={copyCode}
                copiedCode={copiedCode}
              />
            </section>

            {/* Error Handling */}
            <section id="errors" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Error Handling</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">Error Response Format</h3>
                  <CodeBlock
                    id="error-format"
                    language="json"
                    code={`{
  "error": "Error message",
  "details": "Additional context (optional)"
}`}
                    onCopy={copyCode}
                    copied={copiedCode === "error-format"}
                  />
                </div>

                <div>
                  <h3 className="mb-3 font-semibold text-slate-900">HTTP Status Codes</h3>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-slate-700">Code</th>
                          <th className="px-4 py-2 text-left font-medium text-slate-700">Meaning</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr><td className="px-4 py-2 font-mono text-green-600">200</td><td className="px-4 py-2 text-slate-600">Success</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-green-600">201</td><td className="px-4 py-2 text-slate-600">Created</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-green-600">204</td><td className="px-4 py-2 text-slate-600">No Content (successful deletion)</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-orange-600">400</td><td className="px-4 py-2 text-slate-600">Bad Request</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-red-600">401</td><td className="px-4 py-2 text-slate-600">Unauthorized (invalid token)</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-red-600">403</td><td className="px-4 py-2 text-slate-600">Forbidden (insufficient permissions)</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-orange-600">404</td><td className="px-4 py-2 text-slate-600">Not Found</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-red-600">429</td><td className="px-4 py-2 text-slate-600">Rate Limit Exceeded</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-red-600">500</td><td className="px-4 py-2 text-slate-600">Internal Server Error</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            {/* Code Examples */}
            <section id="examples" className="mb-16 scroll-mt-6">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Code Examples</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 font-semibold text-slate-900">JavaScript / Node.js</h3>
                  <CodeBlock
                    id="example-js"
                    language="javascript"
                    code={`const API_TOKEN = process.env.NTS_API_TOKEN;

async function getCustomers() {
  const response = await fetch('${baseUrl}/api/v1/customers', {
    headers: {
      'Authorization': \`Bearer \${API_TOKEN}\`
    }
  });
  
  const data = await response.json();
  console.log(\`Found \${data.pagination.total} customers\`);
  return data.data;
}`}
                    onCopy={copyCode}
                    copied={copiedCode === "example-js"}
                  />
                </div>

                <div>
                  <h3 className="mb-3 font-semibold text-slate-900">Python</h3>
                  <CodeBlock
                    id="example-python"
                    language="python"
                    code={`import requests
import os

API_TOKEN = os.environ['NTS_API_TOKEN']

response = requests.get(
    '${baseUrl}/api/v1/customers',
    headers={'Authorization': f'Bearer {API_TOKEN}'}
)

data = response.json()
print(f"Found {data['pagination']['total']} customers")`}
                    onCopy={copyCode}
                    copied={copiedCode === "example-python"}
                  />
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
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
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => onCopy(code, id)}
        className="absolute right-2 top-2 rounded p-1.5 opacity-0 transition-opacity hover:bg-slate-700 group-hover:opacity-100"
        title="Copy to clipboard"
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

// Endpoint Group Component
function EndpointGroup({
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
    <div className="space-y-6">
      {endpoints.map((endpoint, idx) => (
        <div key={idx} className="rounded-lg border border-slate-200 p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded px-2.5 py-1 text-xs font-semibold ${
              endpoint.method === "GET" ? "bg-blue-100 text-blue-700" :
              endpoint.method === "POST" ? "bg-green-100 text-green-700" :
              endpoint.method === "PUT" ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"
            }`}>
              {endpoint.method}
            </span>
            <code className="rounded bg-slate-100 px-2 py-1 text-sm font-mono text-slate-900">
              {endpoint.path}
            </code>
            <span className="ml-auto rounded bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">
              {endpoint.scope}
            </span>
          </div>
          
          <p className="mb-3 text-slate-600">{endpoint.description}</p>
          
          {endpoint.params && endpoint.params.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Query Parameters</p>
              <div className="flex flex-wrap gap-1.5">
                {endpoint.params.map((param) => (
                  <code key={param} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                    {param}
                  </code>
                ))}
              </div>
            </div>
          )}
          
          {endpoint.body && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Request Body</p>
              <CodeBlock
                id={`${endpoint.method}-${endpoint.path}-body`}
                language="json"
                code={JSON.stringify(endpoint.body, null, 2)}
                onCopy={copyCode}
                copied={copiedCode === `${endpoint.method}-${endpoint.path}-body`}
              />
            </div>
          )}
          
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Example Request</p>
            <CodeBlock
              id={`${endpoint.method}-${endpoint.path}`}
              code={`curl -X ${endpoint.method} "${baseUrl}${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_API_TOKEN"${endpoint.body ? ' \\\n  -H "Content-Type: application/json" \\\n  -d \'' + JSON.stringify(endpoint.body) + '\'' : ''}`}
              onCopy={copyCode}
              copied={copiedCode === `${endpoint.method}-${endpoint.path}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Object Schemas Component
function ObjectSchemas() {
  const [activeTab, setActiveTab] = useState<'customer' | 'task'>('customer');

  const customerFields = [
    { name: 'id', type: 'string (uuid)', desc: 'Unique identifier' },
    { name: 'customer_id', type: 'string', desc: 'Human-readable ID (e.g., NS-0001)' },
    { name: 'broker_id', type: 'string | null', desc: 'Assigned broker (null = unassigned)' },
    { name: 'first_name', type: 'string | null', desc: 'Contact first name' },
    { name: 'last_name', type: 'string | null', desc: 'Contact last name' },
    { name: 'contact_name', type: 'string', desc: 'Full contact name (required)' },
    { name: 'business_name', type: 'string', desc: 'Company/business name (required)' },
    { name: 'email', type: 'string | null', desc: 'Email address' },
    { name: 'phone', type: 'string | null', desc: 'Phone number' },
    { name: 'address', type: 'string | null', desc: 'Street address' },
    { name: 'city', type: 'string | null', desc: 'City' },
    { name: 'state', type: 'string | null', desc: 'State/Province code' },
    { name: 'zip', type: 'string | null', desc: 'ZIP/Postal code' },
    { name: 'status', type: 'string', desc: 'Current status (active, prospect, won, lost, etc.)' },
    { name: 'industry', type: 'string | null', desc: 'Industry category' },
    { name: 'shipping_frequency', type: 'string | null', desc: 'How often they ship' },
    { name: 'opportunity_type', type: 'string | null', desc: 'Type of opportunity' },
    { name: 'estimated_value', type: 'number | null', desc: 'Estimated annual value ($)' },
    { name: 'notes', type: 'string | null', desc: 'Internal notes' },
    { name: 'created_at', type: 'string', desc: 'Creation timestamp (ISO 8601)' },
    { name: 'updated_at', type: 'string', desc: 'Last update timestamp (ISO 8601)' },
  ];

  const taskFields = [
    { name: 'id', type: 'string (uuid)', desc: 'Unique identifier' },
    { name: 'broker_id', type: 'string | null', desc: 'Assigned broker' },
    { name: 'customer_id', type: 'string | null', desc: 'Related customer ID' },
    { name: 'title', type: 'string', desc: 'Task title (required)' },
    { name: 'description', type: 'string | null', desc: 'Task description/notes' },
    { name: 'type', type: 'string', desc: 'Task type (follow_up, call, email, etc.)' },
    { name: 'status', type: 'string', desc: 'Status (pending, completed, overdue, cancelled)' },
    { name: 'priority', type: 'string | null', desc: 'Priority (critical, urgent, high, medium, low)' },
    { name: 'due_date', type: 'string', desc: 'Due date (ISO 8601, required)' },
    { name: 'due_time', type: 'string | null', desc: 'Due time (HH:MM format)' },
    { name: 'completed_at', type: 'string | null', desc: 'Completion timestamp (ISO 8601)' },
    { name: 'created_at', type: 'string', desc: 'Creation timestamp (ISO 8601)' },
    { name: 'updated_at', type: 'string', desc: 'Last update timestamp (ISO 8601)' },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('customer')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'customer'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Customer Object
        </button>
        <button
          onClick={() => setActiveTab('task')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'task'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Task Object
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Field</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(activeTab === 'customer' ? customerFields : taskFields).map((field) => (
              <tr key={field.name} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-900">{field.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{field.type}</td>
                <td className="px-4 py-2.5 text-slate-600">{field.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// API Playground Component
function ApiPlayground({ baseUrl }: { baseUrl: string }) {
  const [apiToken, setApiToken] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('GET /api/v1/customers');
  const [requestBody, setRequestBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const endpoints = [
    'GET /api/v1/customers',
    'GET /api/v1/customers/:id',
    'POST /api/v1/customers',
    'GET /api/v1/tasks',
    'POST /api/v1/tasks',
    'GET /api/v1/unassigned_contacts',
  ];

  const handleTest = async () => {
    if (!apiToken) {
      setError('Please enter an API token');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const [method, path] = selectedEndpoint.split(' ');
      const url = `${baseUrl}${path}`;

      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      };

      if ((method === 'POST' || method === 'PUT') && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(url, options);
      const data = await res.json();

      setResponse({
        status: res.status,
        headers: {
          'x-ratelimit-limit': res.headers.get('x-ratelimit-limit'),
          'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining'),
          'x-ratelimit-reset': res.headers.get('x-ratelimit-reset'),
        },
        data,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">Test Endpoints</h3>
        <p className="mt-1 text-sm text-slate-600">
          Make live requests to test your API integration (free - uses your own API)
        </p>
      </div>

      <div className="space-y-4 p-6">
        {/* API Token Input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            API Token
          </label>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="nts_live_..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Endpoint Selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Endpoint
          </label>
          <select
            value={selectedEndpoint}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {endpoints.map((endpoint) => (
              <option key={endpoint} value={endpoint}>
                {endpoint}
              </option>
            ))}
          </select>
        </div>

        {/* Request Body (for POST/PUT) */}
        {(selectedEndpoint.startsWith('POST') || selectedEndpoint.startsWith('PUT')) && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Request Body (JSON)
            </label>
            <textarea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              placeholder='{"business_name": "Example Corp", "contact_name": "John Doe"}'
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        )}

        {/* Test Button */}
        <button
          onClick={handleTest}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Try It Out
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="mt-1 text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-1 text-xs font-semibold ${
                response.status < 300 ? 'bg-green-100 text-green-700' :
                response.status < 400 ? 'bg-blue-100 text-blue-700' :
                response.status < 500 ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                {response.status}
              </span>
              <span className="text-sm text-slate-600">
                Rate Limit: {response.headers['x-ratelimit-remaining']}/{response.headers['x-ratelimit-limit']}
              </span>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Response</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
                <code>{JSON.stringify(response.data, null, 2)}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
