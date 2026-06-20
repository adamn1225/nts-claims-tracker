/**
 * NTS Claims Tracker — popup logic.
 *
 * View flow:
 *   not configured  -> settings
 *   configured, no session -> login
 *   signed in -> main (tasks / add task / add customer)
 *
 * The same page doubles as a "sticky note" pop-out window when launched with
 * ?window=1 (see popout button).
 */
(function () {
  "use strict";

  const IS_WINDOWED = new URLSearchParams(location.search).get("window") === "1";

  // The DOM tree (#app) can be relocated into a Document Picture-in-Picture
  // window when "anchored on top". `activeDoc` always points at whichever
  // document currently hosts #app, so lookups keep working after the move.
  let activeDoc = document;

  function $(id) {
    return activeDoc.getElementById(id);
  }

  // ---- view switching ---------------------------------------------------

  function showView(name) {
    ["view-settings", "view-login", "view-main"].forEach((v) => {
      $(v).hidden = v !== `view-${name}`;
    });
    const signedInView = name === "main";
    $("logoutBtn").hidden = !signedInView;
    // Pop-out is available everywhere when signed in (spawn multiple stickies).
    $("popoutBtn").hidden = !signedInView;
    // Anchor-on-top only makes sense from a real (popped-out) window.
    $("anchorBtn").hidden = !(IS_WINDOWED && signedInView);
  }

  let toastTimer = null;
  function toast(message, type = "info", ms = 2500) {
    const t = $("toast");
    t.textContent = message;
    t.className = `toast ${type}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.hidden = true;
    }, ms);
  }

  /** Ask the background worker to recompute the overdue badge. */
  function refreshBadge() {
    try {
      chrome.runtime.sendMessage({ type: "refresh-badge" });
    } catch {
      // Worker may be asleep; the periodic alarm will catch up.
    }
  }

  // ---- date helpers -----------------------------------------------------

  function todayIso() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().split("T")[0];
  }

  function formatDue(dueDate, dueTime) {
    // Parse as local wall-clock to avoid UTC day shifts.
    const [y, m, d] = dueDate.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    if (dueTime) {
      const [hh, mm] = dueTime.split(":");
      due.setHours(Number(hh), Number(mm));
    } else {
      due.setHours(23, 59, 59);
    }
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDiff = Math.round((new Date(y, m - 1, d) - startOfToday) / 86400000);

    const timeLabel = dueTime
      ? new Date(`2000-01-01T${dueTime}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    let label;
    let cls = "";
    if (due.getTime() < now.getTime()) {
      label = "Overdue";
      cls = "overdue";
    } else if (dayDiff === 0) {
      label = timeLabel ? `Today ${timeLabel}` : "Today";
      cls = "today";
    } else if (dayDiff === 1) {
      label = timeLabel ? `Tomorrow ${timeLabel}` : "Tomorrow";
    } else {
      label = `${dayDiff}d`;
    }
    return { label, cls };
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  // ---- tasks ------------------------------------------------------------

  async function loadTasks() {
    const list = $("taskList");
    list.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const tasks = await SB.getActiveTasks();
      renderTasks(tasks);
    } catch (err) {
      list.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderTasks(tasks) {
    const list = $("taskList");
    if (!tasks || tasks.length === 0) {
      list.innerHTML = '<div class="empty">No open tasks. You\'re all caught up.</div>';
      return;
    }
    list.innerHTML = "";
    tasks.forEach((task) => {
      const due = formatDue(task.due_date, task.due_time);
      const card = activeDoc.createElement("div");
      card.className = `task-card priority-${task.priority || "medium"}`;
      card.innerHTML = `
        <button class="task-check" title="Mark complete">&#10003;</button>
        <div class="task-body">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span class="task-due ${due.cls}">${escapeHtml(due.label)}</span>
            <span class="badge">${escapeHtml((task.type || "").replace("_", " "))}</span>
          </div>
        </div>`;
      const checkBtn = card.querySelector(".task-check");
      checkBtn.addEventListener("click", () => completeTask(task.id, card));
      list.appendChild(card);
    });
  }

  async function completeTask(taskId, card) {
    const btn = card.querySelector(".task-check");
    btn.disabled = true;
    try {
      await SB.completeTask(taskId);
      card.remove();
      toast("Task completed", "success");
      refreshBadge();
      if ($("taskList").children.length === 0) renderTasks([]);
    } catch (err) {
      btn.disabled = false;
      toast(err.message, "error");
    }
  }

  // ---- add task ---------------------------------------------------------

  async function loadCustomerOptions() {
    const select = $("taskCustomer");
    try {
      const customers = await SB.getCustomers();
      customers.forEach((c) => {
        const opt = activeDoc.createElement("option");
        opt.value = c.id;
        opt.textContent = c.business_name || c.contact_name || "(unnamed)";
        select.appendChild(opt);
      });
    } catch {
      // Non-fatal — the customer picker just stays empty.
    }
  }

  async function loadStatusOptions() {
    const select = $("custStatus");
    try {
      const statuses = await SB.getStatuses();
      if (statuses && statuses.length) {
        select.innerHTML = "";
        statuses.forEach((s) => {
          const opt = activeDoc.createElement("option");
          opt.value = s.name;
          opt.textContent = s.name;
          select.appendChild(opt);
        });
      }
    } catch {
      // Non-fatal — fall back to the default options baked into the HTML.
    }
  }

  async function submitTask(e) {
    e.preventDefault();
    const btn = $("taskSubmit");
    btn.disabled = true;
    try {
      const task = {
        title: $("taskTitle").value.trim(),
        type: $("taskType").value,
        priority: $("taskPriority").value,
        due_date: $("taskDueDate").value,
        due_time: $("taskDueTime").value || null,
        description: $("taskDescription").value.trim() || null,
        customer_id: $("taskCustomer").value || null,
      };
      if (!task.title || !task.due_date) {
        toast("Title and due date are required.", "error");
        btn.disabled = false;
        return;
      }
      await SB.createTask(task);
      $("taskForm").reset();
      $("taskDueDate").value = todayIso();
      toast("Task added", "success");
      refreshBadge();
      switchTab("tasks");
      loadTasks();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  // ---- add customer -----------------------------------------------------

  async function submitCustomer(e) {
    e.preventDefault();
    const btn = $("custSubmit");
    btn.disabled = true;
    try {
      const customer = {
        business_name: $("custBusiness").value.trim(),
        contact_name: $("custContact").value.trim() || null,
        email: $("custEmail").value.trim() || null,
        phone: $("custPhone").value.trim() || null,
        status: $("custStatus").value,
        industry: $("custIndustry").value.trim() || null,
        notes: $("custNotes").value.trim() || null,
      };
      if (!customer.business_name) {
        toast("Business name is required.", "error");
        btn.disabled = false;
        return;
      }
      await SB.createCustomer(customer);
      $("customerForm").reset();
      loadStatusOptions();
      // Refresh the task form's customer picker so the new one is selectable.
      $("taskCustomer").length = 1;
      loadCustomerOptions();
      toast("Customer added", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  // ---- tabs -------------------------------------------------------------

  const TAB_KEY = "sb_active_tab";

  function switchTab(name, persist = true) {
    activeDoc.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("tab-active", t.dataset.tab === name);
    });
    ["tasks", "notes", "add-task", "add-customer"].forEach((p) => {
      $(`tab-${p}`).hidden = p !== name;
    });
    // Remember the last-opened tab so it stays active next time.
    if (persist) chrome.storage.local.set({ [TAB_KEY]: name });
  }

  function getSavedTab() {
    return new Promise((resolve) => {
      chrome.storage.local.get([TAB_KEY], (res) => {
        const saved = res && res[TAB_KEY];
        const valid = ["tasks", "notes", "add-task", "add-customer"];
        resolve(valid.includes(saved) ? saved : "tasks");
      });
    });
  }

  // ---- notes (local scratchpad) -----------------------------------------

  const NOTES_KEY = "sb_notes";
  let notesSaveTimer = null;

  function loadNotes() {
    chrome.storage.local.get([NOTES_KEY], (res) => {
      $("notesPad").value = (res && res[NOTES_KEY]) || "";
    });
  }

  function saveNotes() {
    const status = $("notesStatus");
    status.textContent = "Saving…";
    clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(() => {
      chrome.storage.local.set({ [NOTES_KEY]: $("notesPad").value }, () => {
        status.textContent = "Saved";
      });
    }, 400);
  }

  function clearNotes() {
    $("notesPad").value = "";
    chrome.storage.local.set({ [NOTES_KEY]: "" }, () => {
      $("notesStatus").textContent = "Saved";
    });
    $("notesPad").focus();
  }

  // ---- settings & auth --------------------------------------------------

  async function submitSettings(e) {
    e.preventDefault();
    const url = $("cfgUrl").value;
    const anon = $("cfgAnon").value;
    await SB.setConfig(url, anon);
    toast("Settings saved", "success");
    await routeAfterConfig();
  }

  async function submitLogin(e) {
    e.preventDefault();
    const btn = $("loginSubmit");
    btn.disabled = true;
    try {
      await SB.signIn($("loginEmail").value.trim(), $("loginPassword").value);
      await enterMain();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function logout() {
    await SB.signOut();
    refreshBadge();
    showView("login");
  }

  async function enterMain() {
    showView("main");
    switchTab(await getSavedTab());
    $("taskDueDate").value = todayIso();
    await loadTasks();
    await loadCustomerOptions();
    await loadStatusOptions();
    refreshBadge();
  }

  async function routeAfterConfig() {
    if (!(await SB.isConfigured())) {
      // Prefill if we have partial config.
      const { url, anon } = await SB.getConfig();
      $("cfgUrl").value = url;
      $("cfgAnon").value = anon;
      showView("settings");
      return;
    }
    const session = await SB.getSession();
    if (session) {
      await enterMain();
    } else {
      showView("login");
    }
  }

  async function openSettings() {
    const { url, anon } = await SB.getConfig();
    $("cfgUrl").value = url;
    $("cfgAnon").value = anon;
    showView("settings");
  }

  function popOut() {
    const url = chrome.runtime.getURL("popup.html?window=1");
    chrome.windows.create({
      url,
      type: "popup",
      width: 380,
      height: 620,
    });
    // From the toolbar dropdown, close it so we don't leave a duplicate behind.
    // From an existing sticky window, keep it open — this spawns another note.
    if (!IS_WINDOWED) window.close();
  }

  // ---- anchor on top (Document Picture-in-Picture) ----------------------
  //
  // The chrome.windows API can't make a window always-on-top, but the
  // Document Picture-in-Picture API can: its window floats above everything,
  // even other apps. The browser allows one PiP window at a time, so a single
  // sticky can be anchored while others stay as normal pop-out windows.

  let pipWindow = null;

  function copyStylesInto(targetDoc) {
    document
      .querySelectorAll('link[rel="stylesheet"], style')
      .forEach((node) => targetDoc.head.appendChild(node.cloneNode(true)));
  }

  // While anchored, the source pop-out window is empty, so tuck it out of the
  // way (minimized) and restore it when the content comes back.
  function setSourceWindowState(state) {
    if (!IS_WINDOWED) return;
    try {
      chrome.windows.getCurrent((w) => {
        if (w && w.id != null) {
          chrome.windows.update(
            w.id,
            state === "minimized"
              ? { state: "minimized" }
              : { state: "normal", focused: true }
          );
        }
      });
    } catch {
      // Not in a real window context; nothing to minimize.
    }
  }

  function setAnchored(on) {
    const btn = $("anchorBtn");
    if (btn) {
      btn.classList.toggle("active", on);
      btn.title = on ? "Un-anchor (return window)" : "Anchor on top (always-on-top)";
    }
  }

  async function toggleAnchor() {
    // Already anchored -> closing the PiP window returns the content.
    if (pipWindow) {
      pipWindow.close();
      return;
    }
    if (!("documentPictureInPicture" in window)) {
      toast("Always-on-top needs Chrome 116 or newer.", "error", 3500);
      return;
    }
    try {
      pipWindow = await documentPictureInPicture.requestWindow({
        width: Math.max(320, Math.round(window.innerWidth) || 360),
        height: Math.max(360, Math.round(window.innerHeight) || 600),
      });
      copyStylesInto(pipWindow.document);
      pipWindow.document.body.classList.add("windowed");
      pipWindow.document.body.appendChild($("app"));
      activeDoc = pipWindow.document;
      setAnchored(true);
      // A floating sticky is most useful as a notepad — open Notes, but don't
      // clobber the saved default tab for the normal popup.
      switchTab("notes", false);
      setSourceWindowState("minimized");
      pipWindow.addEventListener("pagehide", onPipClosed, { once: true });
    } catch {
      pipWindow = null;
      toast("Could not anchor the window.", "error");
    }
  }

  function onPipClosed() {
    const app = pipWindow ? pipWindow.document.getElementById("app") : null;
    if (app) document.body.insertBefore(app, document.body.firstChild);
    pipWindow = null;
    activeDoc = document;
    setAnchored(false);
    setSourceWindowState("normal");
  }

  // ---- init -------------------------------------------------------------

  function bind() {
    if (IS_WINDOWED) document.body.classList.add("windowed");

    $("settingsForm").addEventListener("submit", submitSettings);
    $("settingsCancel").addEventListener("click", routeAfterConfig);
    $("loginForm").addEventListener("submit", submitLogin);
    $("taskForm").addEventListener("submit", submitTask);
    $("customerForm").addEventListener("submit", submitCustomer);

    $("settingsBtn").addEventListener("click", openSettings);
    $("logoutBtn").addEventListener("click", logout);
    $("popoutBtn").addEventListener("click", popOut);
    $("anchorBtn").addEventListener("click", toggleAnchor);
    $("refreshTasks").addEventListener("click", loadTasks);

    $("notesPad").addEventListener("input", saveNotes);
    $("notesClear").addEventListener("click", clearNotes);
    loadNotes();

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bind();
    await routeAfterConfig();
  });
})();
