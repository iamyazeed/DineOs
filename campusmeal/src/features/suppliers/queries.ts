import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupplierInfo } from "@/components/shared/table-distribution";

export interface RotationRow {
  id: string;
  table_id: string;
  student_id: string;
  student_name: string;
  period_start: string;
  period_end: string;
}

/** Current supplier per table (rotation covering `date`), plus substitutes for `mealId`. */
export async function getSuppliers(db: SupabaseClient, instId: string, date: string, mealId?: string) {
  const { data: rots } = await db
    .from("supplier_rotations")
    .select("id, table_id, student_id, period_start, period_end, student:students(full_name)")
    .eq("institution_id", instId)
    .lte("period_start", date)
    .gte("period_end", date)
    .range(0, 9999);
  const rotations: RotationRow[] = (rots ?? []).map((r) => ({
    id: r.id,
    table_id: r.table_id,
    student_id: r.student_id,
    period_start: r.period_start,
    period_end: r.period_end,
    student_name: (Array.isArray(r.student) ? r.student[0] : (r.student as { full_name: string } | null))?.full_name ?? "",
  }));
  const subs = new Map<string, string>();
  if (mealId && rotations.length) {
    const { data } = await db
      .from("supplier_substitutions")
      .select("rotation_id, student:students!supplier_substitutions_substitute_student_id_fkey(full_name)")
      .eq("meal_id", mealId);
    for (const s of data ?? []) {
      subs.set(s.rotation_id, (Array.isArray(s.student) ? s.student[0] : (s.student as { full_name: string } | null))?.full_name ?? "");
    }
  }
  const byTable = new Map<string, SupplierInfo>();
  for (const r of rotations) byTable.set(r.table_id, { supplier: r.student_name, substitute: subs.get(r.id) });
  return { rotations, byTable };
}
