import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMyClasses(db: SupabaseClient, instId: string, userId: string) {
  const { data } = await db.from("classes").select("id, name").eq("institution_id", instId).eq("teacher_id", userId).order("name");
  return data ?? [];
}
