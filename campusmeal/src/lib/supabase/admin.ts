// SERVER ONLY. Service-role client used solely for creating auth accounts
// from authorised server actions. Never import this from a client component.
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/config/env";

export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("admin client is server-only");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(supabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
