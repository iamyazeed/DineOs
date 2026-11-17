import type { SupabaseClient } from "@supabase/supabase-js";
import { getMealTotals } from "@/features/meals/queries";
import { addDays } from "@/lib/utils";

/** Cross-institution summary for the last `days` days (super admin; RLS-authorised). */
export async function getUniversitySummary(db: SupabaseClient, today: string, days = 14) {
  const from = addDays(today, -(days - 1));
  const [{ data: insts }, totals] = await Promise.all([
    db.from("institutions").select("id, name, code, active, is_demo, timezone").order("name"),
    getMealTotals(db, from, today),
  ]);
  const rows = (insts ?? []).map((i) => {
    const t = totals.filter((x) => x.institution_id === i.id && x.meal_status !== "cancelled");
    const eligible = t.reduce((a, x) => a + x.eligible, 0);
    return {
      ...i,
      meals: t.length,
      portions: t.reduce((a, x) => a + x.regular + x.separate_portions, 0),
      cancelled: t.reduce((a, x) => a + x.cancelled, 0),
      absent: t.reduce((a, x) => a + x.absent, 0),
      avoided: t.reduce((a, x) => a + x.excluded, 0),
      eligible,
    };
  });
  return { from, totals, rows };
}
