import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Types from schema
export type {
  Broker,
  Customer,
  Task,
  ContactLog,
  ShippingFrequency,
  TaskStatus,
  TaskType,
  ContactLogType,
} from "@/lib/types";
