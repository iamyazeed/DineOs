import type { SupabaseClient } from "@supabase/supabase-js";

export interface DistributionRecord {
  table_id: string;
  collected_at: string | null;
  completed_at: string | null;
}
export interface DeliveryRecord {
  hall_id: string;
  delivery_status: "pending" | "dispatched" | "delivered";
  kitchen_distribution_status: "pending" | "serving" | "completed";
  updated_at: string;
}
export interface MissingReport {
  id: string;
  meal_id: string;
  table_id: string | null;
  portions_missing: number;
  note: string;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  table_code: string | null;
}

export async function getDistributionState(db: SupabaseClient, mealId: string) {
  const [rec, del, miss] = await Promise.all([
    db.from("distribution_records").select("table_id, collected_at, completed_at").eq("meal_id", mealId).range(0, 9999),
    db.from("meal_deliveries").select("hall_id, delivery_status, kitchen_distribution_status, updated_at").eq("meal_id", mealId),
    db
      .from("missing_meal_reports")
      .select("id, meal_id, table_id, portions_missing, note, status, created_at, table:dining_tables(code)")
      .eq("meal_id", mealId)
      .order("created_at", { ascending: false }),
  ]);
  const records = new Map((rec.data ?? []).map((r) => [r.table_id, r as DistributionRecord]));
  const deliveries = new Map((del.data ?? []).map((d) => [d.hall_id, d as DeliveryRecord]));
  const missing: MissingReport[] = (miss.data ?? []).map((m) => ({
    ...(m as unknown as MissingReport),
    table_code: (Array.isArray(m.table) ? m.table[0] : (m.table as { code: string } | null))?.code ?? null,
  }));
  return { records, deliveries, missing };
}

export async function getMissingReports(db: SupabaseClient, instId: string, limit = 50) {
  const { data } = await db
    .from("missing_meal_reports")
    .select("id, meal_id, table_id, portions_missing, note, status, created_at, table:dining_tables(code), meal:meals(meal_date, schedule:meal_schedules(name))")
    .eq("institution_id", instId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((m) => {
    const meal = (Array.isArray(m.meal) ? m.meal[0] : m.meal) as { meal_date: string; schedule: { name: string } | { name: string }[] } | null;
    const sched = meal ? (Array.isArray(meal.schedule) ? meal.schedule[0] : meal.schedule) : null;
    return {
      ...(m as unknown as MissingReport),
      table_code: (Array.isArray(m.table) ? m.table[0] : (m.table as { code: string } | null))?.code ?? null,
      meal_label: meal ? `${sched?.name ?? "Meal"} · ${meal.meal_date}` : "",
    };
  });
}
