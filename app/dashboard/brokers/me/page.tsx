import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in broker's ID and redirects to their profile.
 */
export default async function MyProfileRedirect() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Use the auth user's UUID directly — no email-handle collision possible
  redirect(`/dashboard/brokers/${user.id}`);
}
