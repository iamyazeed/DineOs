import type { SupabaseClient } from "@supabase/supabase-js";
import { getCampusStructure, getMealsInRange, getSeparateRequests } from "@/features/meals/queries";
import { addDays, fmtDate, fmtTime, todayIn } from "@/lib/utils";
import type { Institution } from "@/types/domain";

/** Separate-food requests for meals from yesterday through the next week (RLS filters by role). */
export async function getRecentSeparateRequests(db: SupabaseClient, inst: Institution) {
  const today = todayIn(inst.timezone);
  const [meals, structure] = await Promise.all([getMealsInRange(db, inst, addDays(today, -1), 9), getCampusStructure(db, inst)]);
  const rows = await getSeparateRequests(db, inst.id, meals.map((m) => m.id));
  const mealById = new Map(meals.map((m) => [m.id, m]));
  const names = new Map(structure.students.map((s) => [s.id, `${s.full_name} (#${s.roll_no})`]));
  return {
    rows,
    meals,
    structure,
    mealLabel: (id: string) => {
      const m = mealById.get(id);
      return m ? `${m.schedule.name} · ${fmtDate(m.meal_date)} ${fmtTime(m.schedule.serve_time)}` : "Meal";
    },
    studentName: (id: string) => names.get(id) ?? "Student",
  };
}
