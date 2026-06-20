# MCP Implementation Testing Guide

## 🎯 What We Built

Your ClaimsTracker now has a **Model Context Protocol (MCP) server** that gives AI superpowers to query your CRM database. Three features are enhanced:

1. **Enhanced Call Brief** (`/api/ai/call-brief`)
2. **Natural Language CRM Assistant** (`/api/ai/crm-assistant`)
3. **MCP Server** (runs in background, provides database tools to AI)

---

## 🧪 Quick Tests

###  1. Test MCP Server (Standalone)

**PLAIN ENGLISH:** Make sure the MCP server can start and respond to tool calls.

```bash
# From project root
cd mcp-server
npm start
```

You should see:
```
NTS ClaimsTracker MCP server running on stdio
```

Press `Ctrl+C` to stop. ✅ If it starts without errors, server works!

---

### 2. Test Enhanced Call Brief

**PLAIN ENGLISH:** Call brief now auto-fetches customer history, tasks, and similar customers.

**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/ai/call-brief \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "customerId": "PASTE_A_REAL_CUSTOMER_ID_HERE"
  }'
```

**Expected Response:**
```json
{
  "brief": "Your last call with John at ABC Trucking on Feb 15 discussed quarterly shipping needs for heavy equipment. You have an open task to follow up with a rate quote by today. Talking point: Ask about their Q2 shipment volumes based on similar customers in the construction industry who typically increase orders in spring."
}
```

**What's Different from Before:**
- ✅ Now includes open tasks
- ✅ Mentions similar customers
- ✅ More specific context (dates, details)

---

### 3. Test Natural Language CRM Assistant

**PLAIN ENGLISH:** Ask questions about your data in plain English!

**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/ai/crm-assistant \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "query": "Show me all customers in Texas who ship construction equipment"
  }'
```

**Expected Response:**
```json
{
  "answer": "I found 12 customers in Texas that ship construction equipment:\n\n1. ABC Heavy Haulers (Houston) - Last contact: 3 days ago\n2. Lone Star Logistics (Dallas) - Last contact: 15 days ago\n3. Texas Equipment Transport (Austin) - Last contact: 45 days ago\n\n... (full list)\n\nRecommendation: Focus on Texas Equipment Transport - they haven't been contacted in over 30 days and typically ship monthly.",
  "data": [
    {
      "tool": "search_customers",
      "data": {
        "customers": [...],
        "count": 12
      }
    }
  ],
  "tool_calls": ["search_customers"],
  "suggestions": [
    "Which Texas customers haven't been contacted in 60+ days?",
    "Show me overdue tasks for Texas customers",
    "Analyze my Texas pipeline conversion rate"
  ]
}
```

**Try These Queries:**
```json
// Find cold prospects
{ "query": "Find customers I haven't contacted in 30 days" }

// Task analysis
{ "query": "Show my overdue tasks" }

// Pipeline health
{ "query": "Analyze my pipeline for the last 30 days" }

// Specific search
{ "query": "Find all prospects in the manufacturing industry with weekly shipping frequency" }
```

---

## 📱 Frontend Integration

To use the CRM Assistant from your UI, add this component:

```typescript
// components/CRMAssistant.tsx
"use client";

import { useState } from "react";

export default function CRMAssistant() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const askQuestion = async () => {
    setLoading(true);
    const res = await fetch("/api/ai/crm-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Ask Your CRM</h2>
      
      <textarea
        className="w-full border p-3 rounded"
        placeholder="e.g., Show me all Texas customers who..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
      />
      
      <button
        onClick={askQuestion}
        disabled={loading}
        className="mt-2 px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        {loading ? "Thinking..." : "Ask"}
      </button>

      {result && (
        <div className="mt-6">
          <div className="prose">
            {result.answer}
          </div>
          
          {result.suggestions && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Follow-up questions:</p>
              {result.suggestions.map((s: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setQuery(s)}
                  className="block text-sm text-blue-600 hover:underline mb-1"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 🔍 Debugging

### Check MCP Server Logs

The MCP server logs errors to stderr. In your Next.js API routes, you'll see:
```
[MCP Server Error]: <error details>
[MCP Client] Connected to server
```

### Test Individual Tools

You can test MCP tools directly from Node.js:

```typescript
// test-mcp.ts
import { searchCustomers, listTasks, analyzePipeline } from "./lib/mcp-client";

async function test() {
  // Search customers
  const customers = await searchCustomers({
    state: "TX",
    industry: "Construction",
    limit: 5,
  });
  console.log("Customers:", customers);

  // Get tasks
  const tasks = await listTasks({
    overdue_only: true,
    limit: 10,
  });
  console.log("Overdue tasks:", tasks);

  // Pipeline analytics
  const pipeline = await analyzePipeline(undefined, 30);
  console.log("Pipeline:", pipeline);
}

test();
```

### Common Issues

**❌ "MCP Server Error: ENOENT"**
- **Fix:** Make sure MCP server is built (`cd mcp-server && npm run build`)

**❌ "Cannot find module '@modelcontextprotocol/sdk'"**
- **Fix:** Run `npm install` in root directory

**❌ "Unauthorized" from API endpoints**
- **Fix:** Make sure you're logged in and passing session cookies

**❌ AI returns empty results**
- **Fix:** Check that your database has customer data

---

## 🚀 Next Steps

Now that MCP is working, you can:

1. **Add to Power Dialer** — Show CRM Assistant in sidebar during calls
2. **Enhance Sales Coach** — Give sales coach access to MCP tools
3. **Create Dashboard Widgets** — "Top cold prospects", "Pipeline health" cards
4. **Email Drafting** — Use MCP to pull customer context for smarter emails
5. **Mobile App** — Same API works for React Native app

---

## 📊 Performance Tips

- MCP client reuses connections (no need to reconnect per request)
- First request is slowest (spawns server), subsequent requests are fast
- Consider caching frequent queries (e.g., "my overdue tasks")
- For production, run MCP server as a persistent service instead of spawn-per-request

---

## 🔐 Security Notes

- ✅ MCP server uses service role key (admin access)
- ✅ Authorization happens at Next.js API layer (before MCP calls)
- ✅ Brokers only see their own data (broker_id filtering)
- ✅ Admins/Managers can view team data (permission checking in place)

---

**🎉 You're all set! MCP is now powering your AI features.**
