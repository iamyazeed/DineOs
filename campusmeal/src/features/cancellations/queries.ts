import type { SupabaseClient } from "@supabase/supabase-js";
import { getMealsInRange, type DayMeal } from "@/features/meals/queries";
import { nowLocalIn } from "@/lib/utils";
import type { Institution } from "@/types/domain";

export interface StudentMeal extends DayMeal {
  cancelled: { source: string; cancelled_at: string } | null;
  canChange: boolean;
}

/** The signed-in student's own record and meals with their cancellation state. */
export async function getStudentMeals(db: SupabaseClient, inst: Institution, userId: string, from: string, days: number) {
  const { data: me } = await db.from("students").select("id, full_name, roll_no, class_id").eq("profile_id", userId).maybeSingle();
  const meals = await getMealsInRange(db, inst, from, days);
  const { data: canc } = me
    ? await db.from("meal_cancellations").select("meal_id, source, cancelled_at").eq("student_id", me.id).in("meal_id", meals.map((m) => m.id))
    : { data: [] };
  const byMeal = new Map((canc ?? []).map((c) => [c.meal_id, c]));
  const now = nowLocalIn(inst.timezone);
  const rows: StudentMeal[] = meals.map((m) => ({
    ...m,
    cancelled: byMeal.get(m.id) ?? null,
    canChange: m.status !== "cancelled" && now < m.deadline,
  }));
  return { me, meals: rows };
}
