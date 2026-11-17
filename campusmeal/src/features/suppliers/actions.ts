"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, institutionActionContext } from "@/lib/auth/guards";
import { check, isoDate, optionalText, parseForm, run, uuid } from "@/lib/validations";
import { addDays, todayIn } from "@/lib/utils";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;

/** Set the designated supplier for one table for a rotation period. */
export async function setSupplier(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("teacher", "supplier.manage");
    const d = parseForm(z.object({ table_id: uuid, student_id: uuid, period_start: isoDate }), fd);
    const { data: seat } = await ctx.supabase.from("table_assignments").select("id").eq("table_id", d.table_id).eq("student_id", d.student_id).is("end_date", null).maybeSingle();
    if (!seat) throw new ActionError("The supplier must be seated at this table.");
    const period_end = addDays(d.period_start, ctx.institution.supplier_rotation_days - 1);
    const { error } = await ctx.supabase
      .from("supplier_rotations")
      .upsert({ institution_id: ctx.institution.id, ...d, period_end, assigned_by: ctx.userId }, { onConflict: "table_id,period_start" });
    check(error);
    revalidatePath("/", "layout");
    return `Supplier set until ${period_end}. History is preserved.`;
  });
}

/** Start the next rotation for every table: the next student by class roll number. */
export async function rotateAllSuppliers(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("teacher", "supplier.manage");
    void fd;
    const db = ctx.supabase;
    const today = todayIn(ctx.institution.timezone);
    const [{ data: seats }, { data: rotations }] = await Promise.all([
      db.from("table_assignments").select("table_id, student:students!inner(id, roll_no, full_name, active)").eq("institution_id", ctx.institution.id).is("end_date", null).range(0, 9999),
      db.from("supplier_rotations").select("table_id, student_id, period_start, period_end").eq("institution_id", ctx.institution.id).order("period_start", { ascending: false }),
    ]);
    const byTable = new Map<string, Array<{ id: string; roll_no: number }>>();
    for (const s of seats ?? []) {
      const st = (Array.isArray(s.student) ? s.student[0] : s.student) as { id: string; roll_no: number; active: boolean };
      if (!st?.active) continue;
      byTable.set(s.table_id, [...(byTable.get(s.table_id) ?? []), st]);
    }
    const latest = new Map<string, { student_id: string; period_end: string }>();
    for (const r of rotations ?? []) if (!latest.has(r.table_id)) latest.set(r.table_id, r);
    const rows = [];
    for (const [table_id, list] of byTable) {
      const last = latest.get(table_id);
      if (last && last.period_end >= today) continue; // current period still running
      list.sort((a, b) => a.roll_no - b.roll_no);
      const idx = last ? list.findIndex((s) => s.id === last.student_id) : -1;
      const next = list[(idx + 1) % list.length];
      rows.push({
        institution_id: ctx.institution.id,
        table_id,
        student_id: next.id,
        period_start: today,
        period_end: addDays(today, ctx.institution.supplier_rotation_days - 1),
        assigned_by: ctx.userId,
      });
    }
    if (rows.length === 0) return "All tables already have a supplier for the current period.";
    const { error } = await db.from("supplier_rotations").insert(rows);
    check(error);
    revalidatePath("/", "layout");
    return `Started a new rotation for ${rows.length} table(s).`;
  });
}

/** Substitute an absent supplier for one meal; the original rotation stays intact. */
export async function assignSubstitute(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("teacher", "supplier.manage");
    const d = parseForm(z.object({ rotation_id: uuid, meal_id: uuid, substitute_student_id: uuid, reason: optionalText(200) }), fd);
    const { data: rot } = await ctx.supabase.from("supplier_rotations").select("table_id, student_id").eq("id", d.rotation_id).single();
    if (!rot) throw new ActionError("Rotation not found.");
    if (rot.student_id === d.substitute_student_id) throw new ActionError("Choose a different student as the substitute.");
    const { error } = await ctx.supabase
      .from("supplier_substitutions")
      .upsert({ institution_id: ctx.institution.id, ...d, assigned_by: ctx.userId }, { onConflict: "rotation_id,meal_id" });
    check(error);
    revalidatePath("/", "layout");
    return "Substitute supplier assigned for this meal.";
  });
}
