/**
 * Background service worker — keeps the toolbar badge in sync with the number
 * of overdue tasks.
 *
 * The badge refreshes:
 *   - on install / browser startup
 *   - every few minutes (chrome.alarms)
 *   - immediately when the popup signals a change (task added/completed, login,
 *     logout) via chrome.runtime.sendMessage({ type: "refresh-badge" })
 */
importScripts("supabase-api.js");

const BADGE_COLOR = "#DC2626"; // red — matches --danger in popup.css
const ALARM_NAME = "nts-refresh-badge";
const REFRESH_MINUTES = 5;

async function updateBadge() {
  try {
    if (!(await SB.isConfigured())) {
      return clearBadge();
    }
    const session = await SB.getSession();
    if (!session) {
      return clearBadge();
    }
    const count = await SB.getOverdueCount();
    if (count > 0) {
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      await chrome.action.setBadgeText({ text: count > 99 ? "99+" : String(count) });
    } else {
      await clearBadge();
    }
  } catch (err) {
    // Network/auth hiccup — leave the last known badge rather than flicker.
    console.debug("Badge refresh failed:", err && err.message);
  }
}

async function clearBadge() {
  await chrome.action.setBadgeText({ text: "" });
}

function ensureAlarm() {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_MINUTES });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) updateBadge();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "refresh-badge") {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  return false;
});

// Keyboard shortcut (Alt+Shift+S) — spawn another sticky window without
// reopening the toolbar popup. Customizable at chrome://extensions/shortcuts.
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-sticky") {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html?window=1"),
      type: "popup",
      width: 380,
      height: 620,
    });
  }
});

// Run once when the worker spins up.
ensureAlarm();
updateBadge();
