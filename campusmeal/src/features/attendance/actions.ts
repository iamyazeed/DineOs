"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, institutionActionContext } from "@/lib/auth/guards";
import { check, optionalText, parseForm, run, uuid } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;

const ids = z.array(uuid).or(uuid.transform((v) => [v]));

/**
 * Teacher (or admin) reports students who will not eat at the canteen for a meal.
 * Canteen attendance only — separate from campus/class attendance.
 * Students who already cancelled are skipped so nobody is double-counted.
 */
export async function reportAbsences(_: Prev, fd: FormData) {
  return run(async () => {
    const d = parseForm(z.object({ role: z.enum(["teacher", "institution_admin"]), meal_id: uuid, "student_ids[]": ids, reason: optionalText(200) }), fd);
    const ctx = await institutionActionContext(d.role, "attendance.report");
    const studentIds = d["student_ids[]"];
    if (d.role === "teacher") {
      const { data: own } = await ctx.supabase
        .from("students")
        .select("id, class:classes!inner(teacher_id)")
        .in("id", studentIds)
        .eq("class.teacher_id", ctx.userId);
      if ((own ?? []).length !== studentIds.length) throw new ActionError("You can only report absences for students in your own classes.");
    }
    const { data: meal } = await ctx.supabase.from("meals").select("status").eq("id", d.meal_id).single();
    if (meal?.status === "cancelled") throw new ActionError("This meal is cancelled; no absences are needed.");
    const { data: already } = await ctx.supabase.from("meal_cancellations").select("student_id").eq("meal_id", d.meal_id).in("student_id", studentIds);
    const skip = new Set((already ?? []).map((r) => r.student_id));
    const rows = studentIds
      .filter((id) => !skip.has(id))
      .map((student_id) => ({ institution_id: ctx.institution.id, meal_id: d.meal_id, student_id, reason: d.reason, reported_by: ctx.userId }));
    if (rows.length) {
      const { error } = await ctx.supabase.from("meal_attendance").upsert(rows, { onConflict: "meal_id,student_id", ignoreDuplicates: true });
      check(error);
    }
    revalidatePath("/", "layout");
    return `${rows.length} absence(s) recorded${skip.size ? `; ${skip.size} already cancelled by the student (not double-counted)` : ""}.`;
  });
}

export async function clearAbsence(_: Prev, fd: FormData) {
  return run(async () => {
    const d = parseForm(z.object({ role: z.enum(["teacher", "institution_admin"]), meal_id: uuid, student_id: uuid }), fd);
    const ctx = await institutionActionContext(d.role, "attendance.report");
    const { error } = await ctx.supabase.from("meal_attendance").delete().eq("meal_id", d.meal_id).eq("student_id", d.student_id).eq("institution_id", ctx.institution.id);
    check(error);
    revalidatePath("/", "layout");
    return "Student marked as attending again.";
  });
}
