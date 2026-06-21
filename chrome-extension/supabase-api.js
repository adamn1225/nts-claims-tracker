/**
 * Thin Supabase REST + Auth wrapper for the Chrome extension.
 *
 * Talks directly to Supabase's GoTrue (auth) and PostgREST (data) endpoints
 * with plain fetch — no SDK, no build step. Row Level Security applies because
 * every data request is made with the signed-in teamMember's access token, so a
 * user only ever sees/edits their own rows.
 *
 * Exposes a single global: window.SB
 */
(function () {
  "use strict";

  const CONFIG_KEYS = ["sb_url", "sb_anon"];
  const SESSION_KEY = "sb_session";

  // ---- chrome.storage helpers -------------------------------------------

  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => resolve(res || {}));
    });
  }

  function storageSet(obj) {
    return new Promise((resolve) => {
      chrome.storage.local.set(obj, () => resolve());
    });
  }

  function storageRemove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => resolve());
    });
  }

  // ---- config -----------------------------------------------------------

  async function getConfig() {
    const { sb_url, sb_anon } = await storageGet(CONFIG_KEYS);
    return { url: sb_url || "", anon: sb_anon || "" };
  }

  async function setConfig(url, anon) {
    const clean = String(url || "").trim().replace(/\/+$/, "");
    await storageSet({ sb_url: clean, sb_anon: String(anon || "").trim() });
  }

  async function isConfigured() {
    const { url, anon } = await getConfig();
    return Boolean(url && anon);
  }

  // ---- session ----------------------------------------------------------

  async function getSession() {
    const res = await storageGet([SESSION_KEY]);
    return res[SESSION_KEY] || null;
  }

  async function setSession(session) {
    await storageSet({ [SESSION_KEY]: session });
  }

  async function clearSession() {
    await storageRemove([SESSION_KEY]);
  }

  function normalizeSession(raw) {
    // GoTrue returns expires_at as a unix timestamp (seconds). Fall back to
    // computing it from expires_in when missing.
    const expiresAt =
      raw.expires_at ||
      Math.floor(Date.now() / 1000) + (raw.expires_in || 3600);
    return {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token,
      expires_at: expiresAt,
      user: raw.user || null,
    };
  }

  // ---- auth -------------------------------------------------------------

  async function authRequest(grantType, body) {
    const { url, anon } = await getConfig();
    if (!url || !anon) throw new Error("Supabase URL and key are not configured.");

    const resp = await fetch(`${url}/auth/v1/token?grant_type=${grantType}`, {
      method: "POST",
      headers: {
        apikey: anon,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg =
        data.error_description || data.msg || data.error || "Sign-in failed.";
      throw new Error(msg);
    }
    return normalizeSession(data);
  }

  async function signIn(email, password) {
    const session = await authRequest("password", { email, password });
    await setSession(session);
    return session;
  }

  async function refresh() {
    const session = await getSession();
    if (!session || !session.refresh_token) {
      throw new Error("No session to refresh.");
    }
    const next = await authRequest("refresh_token", {
      refresh_token: session.refresh_token,
    });
    await setSession(next);
    return next;
  }

  async function signOut() {
    await clearSession();
  }

  /** Returns a valid access token, refreshing if it expires within 60s. */
  async function getAccessToken() {
    let session = await getSession();
    if (!session) throw new Error("Not signed in.");
    const nowSec = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - nowSec < 60) {
      session = await refresh();
    }
    return session.access_token;
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  // ---- REST (PostgREST) -------------------------------------------------

  async function rest(path, options = {}, retryOn401 = true) {
    const { url, anon } = await getConfig();
    const token = await getAccessToken();

    const resp = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (resp.status === 401 && retryOn401) {
      // Token may have just expired — refresh once and retry.
      await refresh();
      return rest(path, options, false);
    }

    const text = await resp.text();
    const data = text ? JSON.parse(text) : null;

    if (!resp.ok) {
      const msg =
        (data && (data.message || data.error || data.hint)) ||
        `Request failed (${resp.status}).`;
      throw new Error(msg);
    }
    return data;
  }

  // ---- domain helpers ---------------------------------------------------

  /** Active tasks (pending + overdue) for the signed-in teamMember, soonest first. */
  async function getActiveTasks() {
    const user = await getUser();
    if (!user) throw new Error("Not signed in.");
    const select =
      "id,title,type,priority,status,due_date,due_time,description,customer_id";
    const path =
      `tasks?select=${select}` +
      `&team_member_id=eq.${user.id}` +
      `&status=in.(pending,overdue)` +
      `&order=due_date.asc,due_time.asc`;
    return rest(path, { method: "GET" });
  }

  async function createTask(task) {
    const user = await getUser();
    if (!user) throw new Error("Not signed in.");
    const payload = {
      team_member_id: user.id,
      created_by: user.id,
      status: "pending",
      ...task,
    };
    const rows = await rest("tasks", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async function completeTask(taskId) {
    const path = `tasks?id=eq.${taskId}`;
    return rest(path, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "completed",
        completed_at: new Date().toISOString(),
      }),
    });
  }

  async function createCustomer(customer) {
    const user = await getUser();
    if (!user) throw new Error("Not signed in.");
    const payload = {
      team_member_id: user.id,
      on_kanban_board: true,
      ...customer,
    };
    const rows = await rest("customers", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  /** Lightweight list of the team member's customers for the task's "link to" picker. */
  async function getCustomers() {
    const user = await getUser();
    if (!user) throw new Error("Not signed in.");
    const path =
      "customers?select=id,business_name,contact_name" +
      `&team_member_id=eq.${user.id}` +
      "&order=business_name.asc&limit=500";
    return rest(path, { method: "GET" });
  }

  /** The teamMember's pipeline statuses (custom names), ordered. */
  async function getStatuses() {
    const user = await getUser();
    if (!user) throw new Error("Not signed in.");
    const path =
      "customer_statuses?select=id,name,order" +
      `&team_member_id=eq.${user.id}` +
      "&order=order.asc";
    return rest(path, { method: "GET" });
  }

  /** True if an active task's due moment is in the past (local wall clock). */
  function isTaskOverdue(task) {
    if (!task || !task.due_date) return false;
    const [y, m, d] = task.due_date.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    if (task.due_time) {
      const [hh, mm] = task.due_time.split(":");
      due.setHours(Number(hh), Number(mm), 0, 0);
    } else {
      due.setHours(23, 59, 59, 999);
    }
    return due.getTime() < Date.now();
  }

  /** Count of currently-overdue open tasks (used for the toolbar badge). */
  async function getOverdueCount() {
    const tasks = await getActiveTasks();
    return (tasks || []).filter(isTaskOverdue).length;
  }

  self.SB = {
    getConfig,
    setConfig,
    isConfigured,
    getSession,
    getUser,
    signIn,
    signOut,
    getActiveTasks,
    createTask,
    completeTask,
    createCustomer,
    getCustomers,
    getStatuses,
    isTaskOverdue,
    getOverdueCount,
  };
})();
