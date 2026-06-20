"use client";

import React, { useState } from "react";
import { Circle, Users } from "lucide-react";
import { useOnlinePresence } from "@/contexts/OnlinePresenceContext";

/**
 * Admin-only badge showing how many users currently have the app open.
 * Click to reveal the list of online users. Relies on the
 * OnlinePresenceProvider mounted in the dashboard layout.
 */
export default function OnlineUsersIndicator() {
  const { onlineUsers, onlineCount } = useOnlinePresence();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        title="Users currently online"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <span className="tabular-nums">{onlineCount}</span>
        <span className="hidden sm:inline">
          {onlineCount === 1 ? "user online" : "users online"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Users className="h-3.5 w-3.5" />
            Online now ({onlineCount})
          </div>
          {onlineCount === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">No one online.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {onlineUsers.map((u) => (
                <li
                  key={u.userId}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  <span className="truncate">{u.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
