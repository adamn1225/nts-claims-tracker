"use client";

import { useState } from "react";
import {
  Code, Key, Lock, Zap, CheckCircle2, Copy, Check, Database, ChevronDown, FileText,
  Play, Menu, X, AlertCircle, Loader2, Terminal
} from "lucide-react";

const NAV_SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "authentication", label: "Authentication" },
  { id: "schemas", label: "Object Schemas" },
  {
    id: "customers", label: "Customers API", endpoints: [
      { method: "GET", path: "/api/v1/customers", label: "List Customers" },
      { method: "GET", path: "/api/v1/customers/:id", label: "Get Customer" },
      { method: "POST", path: "/api/v1/customers", label: "Create Customer" },
      { method: "PUT", path: "/api/v1/customers/:id", label: "Update Customer" },
      { method: "DELETE", path: "/api/v1/customers/:id", label: "Delete Customer" },
    ]
  },
  {
    id: "teamMembers", label: "TeamMembers API", endpoints: [
      { method: "GET", path: "/api/v1/team-members", label: "List TeamMembers" },
    ]
  },
  {
    id: "tasks", label: "Tasks API", endpoints: [
      { method: "GET", path: "/api/v1/tasks", label: "List Tasks" },
      { method: "GET", path: "/api/v1/tasks/:id", label: "Get Task" },
      { method: "POST", path: "/api/v1/tasks", label: "Create Task" },
      { method: "PUT", path: "/api/v1/tasks/:id", label: "Update Task" },
      { method: "DELETE", path: "/api/v1/tasks/:id", label: "Delete Task" },
    ]
  },
  { id: "errors", label: "Error Handling" },
];

type Language = "shell" | "node" | "python";

export default function ApiDocsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<string>("GET /api/v1/customers");
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile Header */}
      <div className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-orange-500" />
          <span className="font-semibold">API Docs</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Left Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-56 overflow-y-auto border-r border-slate-200 bg-white transition-transform lg:static lg:top-0 lg:h-screen lg:translate-x-0`}>
        <div className="p-4">
          <div className="mb-6 hidden lg:block">
            <div className="flex items-center gap-2 text-orange-600">
              <Code className="h-5 w-5" />
              <h1 className="font-bold">API Docs</h1>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">NTS Claims Tracker</p>
          </div>

          <nav className="space-y-0.5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className="w-full rounded px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {section.label}
                </button>
                {section.endpoints && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
                    {section.endpoints.map((endpoint) => {
                      const key = `${endpoint.method} ${endpoint.path}`;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setActiveEndpoint(key);
                            scrollToSection(section.id);
                          }}
                          className={`w-full rounded px-2 py-1 text-left text-xs transition-colors ${activeEndpoint === key
                              ? 'bg-orange-50 font-medium text-orange-700'
                              : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <span className={`mr-1.5 font-semibold ${endpoint.method === 'GET' ? 'text-blue-600' :
                              endpoint.method === 'POST' ? 'text-green-600' :
                                endpoint.method === 'PUT' ? 'text-amber-600' :
                                  'text-red-600'
                            }`}>
                            {endpoint.method}
                          </span>
                          {endpoint.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content + Playground */}
      <div className="flex flex-1 overflow-hidden">
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-12">
          <div className="mx-auto max-w-3xl pb-32">
            <IntroductionSection />
            <AuthenticationSection />
            <SchemasSection />
            <CustomersSection activeEndpoint={activeEndpoint} setActiveEndpoint={setActiveEndpoint} />
            <TeamMembersSection activeEndpoint={activeEndpoint} setActiveEndpoint={setActiveEndpoint} />
            <TasksSection activeEndpoint={activeEndpoint} setActiveEndpoint={setActiveEndpoint} />
            <ErrorsSection />
          </div>
        </main>

        {/* Right Playground Panel */}
        <PlaygroundPanel baseUrl={baseUrl} activeEndpoint={activeEndpoint} />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

// Playground Panel Component
function PlaygroundPanel({ baseUrl, activeEndpoint }: { baseUrl: string; activeEndpoint: string }) {
  const [language, setLanguage] = useState<Language>("shell");
  const [apiToken, setApiToken] = useState("");
  const [params, setParams] = useState<Record<string, string>>({
    page: "1",
    limit: "100",
  });
  const [requestBody, setRequestBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [method, path] = activeEndpoint.split(" ");
  const isBodyMethod = method === "POST" || method === "PUT";

  // Get code for selected language
  const getCode = () => {
    const url = `${baseUrl}${path}`;
    const queryString = Object.entries(params)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    if (language === "shell") {
      let code = `curl --request ${method} \\\n  --url '${fullUrl}' \\\n  --header 'Authorization: Bearer YOUR_TOKEN'`;
      if (isBodyMethod && requestBody) {
        code += ` \\\n  --header 'Content-Type: application/json' \\\n  --data '${requestBody}'`;
      }
      return code;
    } else if (language === "node") {
      let code = `const options = {\n  method: '${method}',\n  headers: {\n    'Authorization': 'Bearer YOUR_TOKEN'`;
      if (isBodyMethod) code += `,\n    'Content-Type': 'application/json'`;
      code += `\n  }`;
      if (isBodyMethod && requestBody) {
        code += `,\n  body: JSON.stringify(${requestBody})`;
      }
      code += `\n};\n\nfetch('${fullUrl}', options)\n  .then(res => res.json())\n  .then(data => console.log(data));`;
      return code;
    } else if (language === "python") {
      let code = `import requests\n\nheaders = {'Authorization': 'Bearer YOUR_TOKEN'`;
      if (isBodyMethod) code += `, 'Content-Type': 'application/json'`;
      code += `}\n`;
      if (isBodyMethod && requestBody) {
        code += `\ndata = ${requestBody.replace(/"/g, "'")}\n\nresponse = requests.${method.toLowerCase()}('${fullUrl}', headers=headers, json=data)`;
      } else {
        code += `\nresponse = requests.${method.toLowerCase()}('${fullUrl}', headers=headers)`;
      }
      code += `\nprint(response.json())`;
      return code;
    }
    return "";
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTryIt = async () => {
    if (!apiToken) {
      setError("Please enter an API token in the CREDENTIALS section");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const queryString = Object.entries(params)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
      const url = queryString ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`;

      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      };

      if (isBodyMethod && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(url, options);
      const data = await res.json();

      setResponse({
        status: res.status,
        data,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hidden w-125 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50 lg:block">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
        <h3 className="font-semibold text-slate-900">API Playground</h3>
      </div>

      <div className="space-y-4 p-6">
        {/* Language Tabs */}
        <div className="flex gap-1 rounded-lg bg-slate-200 p-1">
          <button
            onClick={() => setLanguage("shell")}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${language === "shell" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Terminal className="mr-1.5 inline h-3 w-3" />
            Shell
          </button>
          <button
            onClick={() => setLanguage("node")}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${language === "node" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
          >
            Node
          </button>
          <button
            onClick={() => setLanguage("python")}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${language === "python" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
          >
            Python
          </button>
        </div>

        {/* Credentials */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credentials</label>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Authorization</span>
              <Lock className="h-3 w-3 text-slate-400" />
            </div>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Bearer nts_live_..."
              className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-mono focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Code Display */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {language === "shell" ? "CURL Request" : language === "node" ? "Node.js" : "Python"}
            </label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-orange-600"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 min-h-32 text-xs text-slate-100">
            <code>{getCode()}</code>
          </pre>
        </div>


        {/* Query Parameters */}
        {method === "GET" && (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Query Params</label>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">page</label>
                <input
                  type="text"
                  value={params.page || ""}
                  onChange={(e) => setParams({ ...params, page: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">limit</label>
                <input
                  type="text"
                  value={params.limit || ""}
                  onChange={(e) => setParams({ ...params, limit: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              {path.includes("/customers") && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">status</label>
                    <input
                      type="text"
                      value={params.status || ""}
                      onChange={(e) => setParams({ ...params, status: e.target.value })}
                      placeholder="active"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">search</label>
                    <input
                      type="text"
                      value={params.search || ""}
                      onChange={(e) => setParams({ ...params, search: e.target.value })}
                      placeholder="keyword"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </>
              )}
              {path.includes("/team-members") && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">office_location</label>
                    <input
                      type="text"
                      value={params.office_location || ""}
                      onChange={(e) => setParams({ ...params, office_location: e.target.value })}
                      placeholder="Dallas"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">search</label>
                    <input
                      type="text"
                      value={params.search || ""}
                      onChange={(e) => setParams({ ...params, search: e.target.value })}
                      placeholder="john"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">include_inactive</label>
                    <select
                      value={params.include_inactive || "false"}
                      onChange={(e) => setParams({ ...params, include_inactive: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  </div>
                </>
              )}
              {path.includes("/tasks") && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">status</label>
                    <input
                      type="text"
                      value={params.status || ""}
                      onChange={(e) => setParams({ ...params, status: e.target.value })}
                      placeholder="pending"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">priority</label>
                    <input
                      type="text"
                      value={params.priority || ""}
                      onChange={(e) => setParams({ ...params, priority: e.target.value })}
                      placeholder="high"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">type</label>
                    <input
                      type="text"
                      value={params.type || ""}
                      onChange={(e) => setParams({ ...params, type: e.target.value })}
                      placeholder="call"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">customer_id</label>
                    <input
                      type="text"
                      value={params.customer_id || ""}
                      onChange={(e) => setParams({ ...params, customer_id: e.target.value })}
                      placeholder="uuid"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">due_after</label>
                    <input
                      type="text"
                      value={params.due_after || ""}
                      onChange={(e) => setParams({ ...params, due_after: e.target.value })}
                      placeholder="2026-03-01"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-600">due_before</label>
                    <input
                      type="text"
                      value={params.due_before || ""}
                      onChange={(e) => setParams({ ...params, due_before: e.target.value })}
                      placeholder="2026-03-31"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Request Body */}
        {isBodyMethod && (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Request Body</label>
            <textarea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              placeholder='{"business_name": "Example Corp", "contact_name": "John Doe"}'
              rows={6}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        )}

        {/* Try It Button */}
        <button
          onClick={handleTryIt}
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
              Try It!
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Response */}
        {response && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${response.status < 300 ? 'bg-green-100 text-green-700' :
                  response.status < 400 ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                }`}>
                {response.status}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Response</span>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
              <code>{JSON.stringify(response.data, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Copy Section Helpers ───────────────────────────────────────────────────

function convertToMarkdown(sectionEl: HTMLElement): string {
  const lines: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;
    if (['button', 'svg', 'path', 'script', 'style'].includes(tag)) return;

    if (tag === 'h1') { lines.push(`# ${el.textContent?.trim()}\n`); }
    else if (tag === 'h2') { lines.push(`## ${el.textContent?.trim()}\n`); }
    else if (tag === 'h3') { lines.push(`### ${el.textContent?.trim()}\n`); }
    else if (tag === 'h4') { lines.push(`#### ${el.textContent?.trim()}\n`); }
    else if (tag === 'pre') {
      lines.push(`\`\`\`\n${el.textContent?.trim()}\n\`\`\`\n`);
    } else if (tag === 'p') {
      const text = el.textContent?.trim();
      if (text) lines.push(`${text}\n`);
    } else if (tag === 'ul') {
      Array.from(el.querySelectorAll(':scope > li')).forEach(li => {
        lines.push(`- ${li.textContent?.trim()}`);
      });
      lines.push('');
    } else if (tag === 'ol') {
      Array.from(el.querySelectorAll(':scope > li')).forEach((li, i) => {
        lines.push(`${i + 1}. ${li.textContent?.trim()}`);
      });
      lines.push('');
    } else if (tag === 'table') {
      const headers = Array.from(el.querySelectorAll('thead th')).map(th => th.textContent?.trim() ?? '');
      if (headers.length > 0) {
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
      }
      el.querySelectorAll('tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() ?? '');
        lines.push(`| ${cells.join(' | ')} |`);
      });
      lines.push('');
    } else {
      Array.from(el.childNodes).forEach(walk);
    }
  }

  Array.from(sectionEl.childNodes).forEach(walk);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function CopySectionButton({ sectionId }: { sectionId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (format: 'markdown' | 'text') => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const content = format === 'markdown'
      ? convertToMarkdown(el as HTMLElement)
      : (el as HTMLElement).innerText;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(format);
      setOpen(false);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied!' : 'Copy'}
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => copy('markdown')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
            >
              <Code className="h-3.5 w-3.5 text-slate-400" />
              Copy as Markdown
            </button>
            <button
              onClick={() => copy('text')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Copy as Plain Text
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Section Components
function IntroductionSection() {
  return (
    <section id="introduction" className="mb-12 scroll-mt-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">API Documentation</h1>
        <CopySectionButton sectionId="introduction" />
      </div>
      <p className="text-lg text-slate-600">
        RESTful API for managing customers, tasks, and contacts. Secure, scalable, and easy to integrate with your applications.
      </p>
    </section>
  );
}

function AuthenticationSection() {
  return (
    <section id="authentication" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Lock className="h-6 w-6 text-orange-500" />
          Authentication
        </h2>
        <CopySectionButton sectionId="authentication" />
      </div>
      <p className="mb-4 text-slate-600">
        All API requests require authentication using Bearer tokens. Include your API token in the <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">Authorization</code> header.
      </p>
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
        <p className="text-sm text-orange-900">
          <strong>Create tokens:</strong> Admin Dashboard → API Tokens tab
        </p>
      </div>
      <div className="mt-4">
        <h3 className="mb-2 font-semibold text-slate-900">Rate Limits</h3>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>• Default: 10,000 requests/hour per token</li>
          <li>• Headers: <code className="text-xs">X-RateLimit-Limit</code>, <code className="text-xs">X-RateLimit-Remaining</code>, <code className="text-xs">X-RateLimit-Reset</code></li>
        </ul>
      </div>
    </section>
  );
}

function SchemasSection() {
  return (
    <section id="schemas" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Database className="h-6 w-6 text-orange-500" />
          Object Schemas
        </h2>
        <CopySectionButton sectionId="schemas" />
      </div>
      <p className="mb-4 text-slate-600">View complete field references in the playground on the right by selecting different endpoints.</p>
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-2 font-semibold text-slate-900">Customer Object</h3>
        <p className="text-sm text-slate-600">
          Key fields: <code className="text-xs">id</code>, <code className="text-xs">business_name</code>, <code className="text-xs">contact_name</code>,
          <code className="text-xs">email</code>, <code className="text-xs">phone</code>, <code className="text-xs">city</code>, <code className="text-xs">state</code>, <code className="text-xs">status</code>
        </p>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 p-4">
        <h3 className="mb-2 font-semibold text-slate-900">Task Object</h3>
        <p className="text-sm text-slate-600">
          Key fields: <code className="text-xs">id</code>, <code className="text-xs">title</code>, <code className="text-xs">type</code>,
          <code className="text-xs">status</code>, <code className="text-xs">priority</code>, <code className="text-xs">due_date</code>
        </p>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 p-4">
        <h3 className="mb-2 font-semibold text-slate-900">TeamMember Object</h3>
        <p className="text-sm text-slate-600">
          Key fields: <code className="text-xs">id</code>, <code className="text-xs">first_name</code>, <code className="text-xs">last_name</code>,
          <code className="text-xs">email</code>, <code className="text-xs">office_location</code>, <code className="text-xs">territory</code>, <code className="text-xs">is_active</code>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <strong>Note:</strong> Sensitive fields (is_admin, is_manager, phone) are excluded from API responses.
        </p>
      </div>
    </section>
  );
}

function CustomersSection({ activeEndpoint, setActiveEndpoint }: { activeEndpoint: string; setActiveEndpoint: (e: string) => void }) {
  return (
    <section id="customers" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Customers API</h2>
        <CopySectionButton sectionId="customers" />
      </div>

      {/* team_member_id behavior explanation */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 font-semibold text-blue-900">Assigning Customers to TeamMembers</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>When creating customers, you have 3 options:</strong></p>
          <ul className="ml-4 list-disc space-y-1">
            <li><code className="rounded bg-blue-100 px-1">team_member_id: null</code> - Create unassigned contact for distribution (import pool)</li>
            <li><code className="rounded bg-blue-100 px-1">team_member_id: "uuid"</code> - Assign directly to a specific teamMember</li>
            <li><em>Omit team_member_id</em> - Defaults to the API token owner (backward compatibility)</li>
          </ul>
          <p className="mt-3 text-xs">
            💡 <strong>Tip:</strong> For bulk imports, use <code className="rounded bg-blue-100 px-1">POST /api/v1/unassigned_contacts</code>
            to create contacts in the distribution pool, then assign them later via your admin interface.
          </p>
        </div>
      </div>

      <EndpointDoc
        method="GET"
        path="/api/v1/customers"
        title="List all customers"
        description="Retrieve customers assigned to the API token owner. Supports pagination and filtering by status, city, state, industry, or search query."
        active={activeEndpoint === "GET /api/v1/customers"}
        onClick={() => setActiveEndpoint("GET /api/v1/customers")}
        scope="customers:read"
      />
      <EndpointDoc
        method="POST"
        path="/api/v1/customers"
        title="Create a customer"
        description="Create a new customer. Include 'team_member_id: null' for unassigned contacts, or a team member UUID to assign directly. Omit team_member_id to default to token owner."
        active={activeEndpoint === "POST /api/v1/customers"}
        onClick={() => setActiveEndpoint("POST /api/v1/customers")}
        scope="customers:create"
      />
    </section>
  );
}

function TeamMembersSection({ activeEndpoint, setActiveEndpoint }: { activeEndpoint: string; setActiveEndpoint: (e: string) => void }) {
  return (
    <section id="teamMembers" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">TeamMembers API</h2>
        <CopySectionButton sectionId="teamMembers" />
      </div>
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 font-semibold text-blue-900">TeamMember Assignment</h3>
        <p className="text-sm text-blue-800">
          Use this endpoint to retrieve active team member profiles for customer assignment. The teamMember <code className="rounded bg-blue-100 px-1">id</code> returned here is used as <code className="rounded bg-blue-100 px-1">team_member_id</code> when creating or updating customers.
        </p>
        <p className="mt-2 text-sm text-blue-800">
          <strong>Note:</strong> Sensitive fields (is_admin, is_manager, phone) are excluded from API responses.
        </p>
      </div>
      <EndpointDoc
        method="GET"
        path="/api/v1/team-members"
        title="List active team members"
        description="Retrieve active team member profiles for customer assignment. Supports filtering by office_location, search (name/email), and include_inactive flag. Returns: id, first_name, last_name, email, office_location, territory, is_active."
        active={activeEndpoint === "GET /api/v1/team-members"}
        onClick={() => setActiveEndpoint("GET /api/v1/team-members")}
        scope="team_members:read"
      />
    </section>
  );
}

function TasksSection({ activeEndpoint, setActiveEndpoint }: { activeEndpoint: string; setActiveEndpoint: (e: string) => void }) {
  return (
    <section id="tasks" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Tasks API</h2>
        <CopySectionButton sectionId="tasks" />
      </div>
      <EndpointDoc
        method="GET"
        path="/api/v1/tasks"
        title="List all tasks"
        description="Retrieve a paginated list of tasks. Supports filtering by status, priority, type, customer_id, due_after, due_before. Returns tasks for the authenticated team member."
        active={activeEndpoint === "GET /api/v1/tasks"}
        onClick={() => setActiveEndpoint("GET /api/v1/tasks")}
        scope="tasks:read"
      />
      <EndpointDoc
        method="GET"
        path="/api/v1/tasks/:id"
        title="Get single task"
        description="Retrieve a specific task by ID. Returns 404 if task not found or doesn't belong to authenticated team member."
        active={activeEndpoint === "GET /api/v1/tasks/:id"}
        onClick={() => setActiveEndpoint("GET /api/v1/tasks/:id")}
        scope="tasks:read"
      />
      <EndpointDoc
        method="POST"
        path="/api/v1/tasks"
        title="Create a task"
        description="Create a new task. Required fields: title, due_date. Task is automatically assigned to the authenticated team member."
        active={activeEndpoint === "POST /api/v1/tasks"}
        onClick={() => setActiveEndpoint("POST /api/v1/tasks")}
        scope="tasks:create"
      />
      <EndpointDoc
        method="PUT"
        path="/api/v1/tasks/:id"
        title="Update task"
        description="Update an existing task. Protected fields (id, team_member_id, created_at) cannot be modified."
        active={activeEndpoint === "PUT /api/v1/tasks/:id"}
        onClick={() => setActiveEndpoint("PUT /api/v1/tasks/:id")}
        scope="tasks:write"
      />
      <EndpointDoc
        method="DELETE"
        path="/api/v1/tasks/:id"
        title="Delete task"
        description="Delete a task by ID. Returns 204 on success, 404 if task not found or doesn't belong to authenticated team member."
        active={activeEndpoint === "DELETE /api/v1/tasks/:id"}
        onClick={() => setActiveEndpoint("DELETE /api/v1/tasks/:id")}
        scope="tasks:delete"
      />
    </section>
  );
}

function UnassignedSection({ activeEndpoint, setActiveEndpoint }: { activeEndpoint: string; setActiveEndpoint: (e: string) => void }) {
  return (
    <section id="unassigned" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Unassigned Contacts API</h2>
        <CopySectionButton sectionId="unassigned" />
      </div>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="mb-2 font-semibold text-amber-900">Distribution Workflow</h3>
        <p className="mb-2 text-sm text-amber-800">
          Unassigned contacts (team_member_id = null) live in the import pool awaiting distribution to sales teamMembers.
        </p>
        <div className="mt-3 space-y-1 text-sm text-amber-800">
          <p><strong>Typical workflow:</strong></p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Import contacts via <code className="rounded bg-amber-100 px-1">POST /api/v1/unassigned_contacts</code></li>
            <li>View import pool via <code className="rounded bg-amber-100 px-1">GET /api/v1/unassigned_contacts</code></li>
            <li>Assign to teamMembers via <code className="rounded bg-amber-100 px-1">PUT /api/v1/customers/:id</code> (set team_member_id)</li>
          </ol>
        </div>
      </div>
      <EndpointDoc
        method="GET"
        path="/api/v1/unassigned_contacts"
        title="List unassigned contacts"
        description="Retrieve all contacts from the import pool (team_member_id = null). Supports filtering by import_source, city, state, industry, and search."
        active={activeEndpoint === "GET /api/v1/unassigned_contacts"}
        onClick={() => setActiveEndpoint("GET /api/v1/unassigned_contacts")}
        scope="unassigned_contacts:read"
      />
      <EndpointDoc
        method="GET"
        path="/api/v1/unassigned_contacts/:id"
        title="Get unassigned contact"
        description="Retrieve a specific unassigned contact by ID. Returns 404 if contact not found or already assigned to a team member."
        active={activeEndpoint === "GET /api/v1/unassigned_contacts/:id"}
        onClick={() => setActiveEndpoint("GET /api/v1/unassigned_contacts/:id")}
        scope="unassigned_contacts:read"
      />
      <EndpointDoc
        method="POST"
        path="/api/v1/unassigned_contacts"
        title="Import unassigned contact"
        description="Create a contact in the import pool (team_member_id = null). Ideal for bulk imports from external systems before distribution."
        active={activeEndpoint === "POST /api/v1/unassigned_contacts"}
        onClick={() => setActiveEndpoint("POST /api/v1/unassigned_contacts")}
        scope="unassigned_contacts:create"
      />
      <EndpointDoc
        method="PUT"
        path="/api/v1/unassigned_contacts/:id"
        title="Update unassigned contact"
        description="Update an unassigned contact. Can be used to assign to a team member by setting team_member_id. Protected fields: id, created_at."
        active={activeEndpoint === "PUT /api/v1/unassigned_contacts/:id"}
        onClick={() => setActiveEndpoint("PUT /api/v1/unassigned_contacts/:id")}
        scope="unassigned_contacts:write"
      />
      <EndpointDoc
        method="DELETE"
        path="/api/v1/unassigned_contacts/:id"
        title="Delete unassigned contact"
        description="Delete an unassigned contact from the import pool. Returns 204 on success, 404 if not found or already assigned."
        active={activeEndpoint === "DELETE /api/v1/unassigned_contacts/:id"}
        onClick={() => setActiveEndpoint("DELETE /api/v1/unassigned_contacts/:id")}
        scope="unassigned_contacts:delete"
      />
    </section>
  );
}

function SmsCampaignSection({ activeEndpoint, setActiveEndpoint }: { activeEndpoint: string; setActiveEndpoint: (e: string) => void }) {
  return (
    <section id="sms-campaign" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">SMS Campaign API</h2>
        <CopySectionButton sectionId="sms-campaign" />
      </div>

      <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <h3 className="mb-2 font-semibold text-purple-900">NTS SMS Campaign Integration</h3>
        <p className="mb-3 text-sm text-purple-800">
          Use this endpoint to submit contacts and freight details gathered during SMS campaign conversations.
          The contact is automatically tagged with <code className="rounded bg-purple-100 px-1">import_source: &quot;NTS SMS Campaign&quot;</code>
          and routed based on the <code className="rounded bg-purple-100 px-1">team_member_id</code> field.
        </p>
        <div className="space-y-2 text-sm text-purple-800">
          <p><strong>Routing rules:</strong></p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <code className="rounded bg-purple-100 px-1">team_member_id</code> provided →
              assigned to that teamMember&apos;s <strong>Inbox</strong> on their kanban board
              (<code className="rounded bg-purple-100 px-1">status: &quot;inbox&quot;</code>,{" "}
              <code className="rounded bg-purple-100 px-1">on_kanban_board: true</code>)
            </li>
            <li>
              <code className="rounded bg-purple-100 px-1">team_member_id</code> omitted or <code className="rounded bg-purple-100 px-1">null</code> →
              placed in <strong>Distribution Center</strong> (unassigned pool, <code className="rounded bg-purple-100 px-1">team_member_id: null</code>)
            </li>
          </ul>
          <p className="mt-3">
            <strong>TeamMember dropdown:</strong> Use{" "}
            <code className="rounded bg-purple-100 px-1">GET /api/v1/team-members</code> to populate the team member
            select list in your SMS form. The first option should be &quot;Unassigned&quot; (no{" "}
            <code className="rounded bg-purple-100 px-1">team_member_id</code>).
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-2 font-semibold text-slate-900">Example Request Body</h3>
        <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{`POST /api/v1/sms-campaign-contact
Authorization: Bearer <api_token>
Content-Type: application/json

{
  "business_name": "Acme Freight LLC",
  "first_name": "John",
  "last_name": "Smith",
  "phone": "555-123-4567",
  "email": "john@acmefreight.com",
  "city": "Dallas",
  "state": "TX",
  "notes": "Hauls heavy equipment, needs monthly quote",
  "team_member_id": "<team-member-uuid-from-GET-/api/v1/team-members>"
}`}</pre>
        <p className="mt-3 text-xs text-slate-500">
          Omit <code>team_member_id</code> (or set to <code>null</code>) to route to the Distribution Center instead.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-2 font-semibold text-slate-900">Example Response</h3>
        <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{`HTTP/1.1 201 Created

{
  "data": { /* full customer record */ },
  "routed_to": "broker_inbox",   // or "distribution_center"
  "import_source": "NTS SMS Campaign"
}`}</pre>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 p-4">
        <h3 className="mb-2 font-semibold text-slate-900">Accepted Fields</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Field</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Type</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Required</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="px-3 py-2 font-mono text-xs">business_name</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Conditional*</td><td className="px-3 py-2">Company name</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">first_name</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Conditional*</td><td className="px-3 py-2">Contact first name</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">last_name</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Contact last name</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">contact_name</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Conditional*</td><td className="px-3 py-2">Full name fallback</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">phone</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Primary phone</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">email</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Email address</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">city</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">City</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">state</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">2-letter state code</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">industry</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Industry/commodity type</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">shipping_frequency</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">e.g. &quot;weekly&quot;, &quot;monthly&quot;</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">notes</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Freight details / conversation notes</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">team_member_id</td><td className="px-3 py-2">uuid | null</td><td className="px-3 py-2">No</td><td className="px-3 py-2">From GET /api/v1/team-members. Null = Distribution Center</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">* At least one of <code>business_name</code>, <code>first_name</code>, or <code>contact_name</code> is required.</p>
        <p className="mt-1 text-xs text-slate-500">Fields <code>import_source</code>, <code>status</code>, <code>on_kanban_board</code>, and <code>id</code> are set automatically and cannot be overridden.</p>
      </div>

      <EndpointDoc
        method="POST"
        path="/api/v1/sms-campaign-contact"
        title="Submit SMS campaign contact"
        description="Ingest a contact from an SMS campaign conversation. Automatically tags with import_source='NTS SMS Campaign' and routes to team member Inbox (if team_member_id provided) or Distribution Center (if unassigned)."
        active={activeEndpoint === "POST /api/v1/sms-campaign-contact"}
        onClick={() => setActiveEndpoint("POST /api/v1/sms-campaign-contact")}
        scope="customers:create"
      />
    </section>
  );
}

function ErrorsSection() {
  return (
    <section id="errors" className="mb-12 scroll-mt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Error Handling</h2>
        <CopySectionButton sectionId="errors" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Code</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr><td className="px-4 py-2 font-mono text-green-600">200</td><td className="px-4 py-2">Success</td></tr>
            <tr><td className="px-4 py-2 font-mono text-red-600">401</td><td className="px-4 py-2">Unauthorized</td></tr>
            <tr><td className="px-4 py-2 font-mono text-red-600">403</td><td className="px-4 py-2">Forbidden</td></tr>
            <tr><td className="px-4 py-2 font-mono text-orange-600">404</td><td className="px-4 py-2">Not Found</td></tr>
            <tr><td className="px-4 py-2 font-mono text-red-600">429</td><td className="px-4 py-2">Rate Limit Exceeded</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EndpointDoc({ method, path, title, description, active, onClick, scope }: {
  method: string;
  path: string;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
  scope: string;
}) {
  return (
    <div
      className={`mb-4 cursor-pointer rounded-lg border p-4 transition-colors ${active ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
        }`}
      onClick={onClick}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${method === 'GET' ? 'bg-blue-100 text-blue-700' :
            method === 'POST' ? 'bg-green-100 text-green-700' :
              method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
          }`}>
          {method}
        </span>
        <code className="text-sm font-mono text-slate-900">{path}</code>
        <span className="ml-auto text-xs text-slate-500">{scope}</span>
      </div>
      <h3 className="mb-1 font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
      {active && (
        <p className="mt-2 text-xs text-orange-700">
          → View code and test in the playground on the right
        </p>
      )}
    </div>
  );
}
