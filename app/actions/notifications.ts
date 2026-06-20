"use server";

import { createClient } from "@/lib/supabase/server";
import { generateOverdueNotifications } from "@/lib/notifications";

/**
 * Server Action: Check and generate overdue notifications
 * This runs on the server, so it can safely use all server-side code
 */
export async function checkOverdueNotifications() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  await generateOverdueNotifications(user.id);
}
