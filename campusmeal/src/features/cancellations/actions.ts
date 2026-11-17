"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, institutionActionContext } from "@/lib/auth/guards";
import { check, optionalText, parseForm, run, uuid } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;

/** Student cancels their own upcoming meal. Deadline enforced in the database trigger. */
export async function cancelMyMeal(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("student", "meal.cancelOwn");
    const d = parseForm(z.object({ meal_id: uuid }), fd);
    const { data: me } = await ctx.supabase.from("students").select("id").eq("profile_id", ctx.userId).single();
    if (!me) throw new ActionError("Your login is not linked to a student record.");
    const { error } = await ctx.supabase
      .from("meal_cancellations")
      .insert({ institution_id: ctx.institution.id, meal_id: d.meal_id, student_id: me.id, source: "student" });
    check(error, "You have already cancelled this meal.");
    revalidatePath("/", "layout");
    return "Meal cancelled. The kitchen will prepare one portion fewer.";
  });
}

export async function undoMyCancellation(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("student", "meal.cancelOwn");
    const d = parseForm(z.object({ meal_id: uuid }), fd);
    const { data: me } = await ctx.supabase.from("students").select("id").eq("profile_id", ctx.userId).single();
    if (!me) throw new ActionError("Your login is not linked to a student record.");
    const { error, count } = await ctx.supabase
      .from("meal_cancellations")
      .delete({ count: "exact" })
      .eq("meal_id", d.meal_id)
      .eq("student_id", me.id)
      .eq("source", "student");
    check(error);
    if (!count) throw new ActionError("Nothing to restore.");
    revalidatePath("/", "layout");
    return "Your meal is back on.";
  });
}

/** Authorised late change after the deadline (teacher or admin). */
export async function recordLateException(_: Prev, fd: FormData) {
  return run(async () => {
    const d = parseForm(z.object({ role: z.enum(["teacher", "institution_admin"]), meal_id: uuid, student_id: uuid, note: optionalText(200) }), fd);
    const ctx = await institutionActionContext(d.role, "meal.lateException");
    const { error } = await ctx.supabase.from("meal_cancellations").insert({
      institution_id: ctx.institution.id,
      meal_id: d.meal_id,
      student_id: d.student_id,
      source: "exception",
      note: d.note,
    });
    check(error, "This student's meal is already cancelled.");
    revalidatePath("/", "layout");
    return "Late cancellation recorded as an authorised exception.";
  });
}
