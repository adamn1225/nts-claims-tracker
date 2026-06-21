"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Tracks which signed-in users currently have the app open, using Supabase
 * Realtime Presence. Every dashboard client joins the shared "online-users"
 * channel and broadcasts a lightweight presence record. Any consumer can read
 * the aggregated list — but it's only surfaced to admins in the UI for now.
 *
 * Presence is keyed by user id, so multiple tabs from the same user collapse
 * into a single "online" entry.
 */

export interface OnlineUser {
  userId: string;
  name: string;
  onlineAt: string;
}

interface OnlinePresenceValue {
  onlineUsers: OnlineUser[];
  onlineCount: number;
}

const OnlinePresenceContext = createContext<OnlinePresenceValue>({
  onlineUsers: [],
  onlineCount: 0,
});

const PRESENCE_CHANNEL = "online-users";

export function OnlinePresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("first_name, last_name, email")
        .eq("id", user.id)
        .single();

      const name =
        `${teamMember?.first_name ?? ""} ${teamMember?.last_name ?? ""}`.trim() ||
        teamMember?.email ||
        user.email ||
        "Unknown user";

      channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;
          const state = channel.presenceState();
          const users: OnlineUser[] = Object.entries(state).map(
            ([key, metas]) => {
              const meta = (metas as Array<Record<string, unknown>>)[0] || {};
              return {
                userId: key,
                name: (meta.name as string) || "Unknown user",
                onlineAt: (meta.online_at as string) || "",
              };
            },
          );
          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel) {
            await channel.track({
              name,
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <OnlinePresenceContext.Provider
      value={{ onlineUsers, onlineCount: onlineUsers.length }}
    >
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlinePresence() {
  return useContext(OnlinePresenceContext);
}
