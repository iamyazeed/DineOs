"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, institutionActionContext } from "@/lib/auth/guards";
import { check, parseForm, requiredText, run, uuid } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;

/** Teacher-side distribution: food collected → distribution completed. */
export async function markTableDistribution(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("teacher", "distribution.teacher");
    const d = parseForm(z.object({ meal_id: uuid, table_id: uuid, step: z.enum(["collected", "completed", "undo"]) }), fd);
    const db = ctx.supabase;
    const { data: meal } = await db.from("meals").select("status").eq("id", d.meal_id).eq("institution_id", ctx.institution.id).single();
    if (!meal) throw new ActionError("Meal not found.");
    if (meal.status === "cancelled") throw new ActionError("This meal is cancelled.");
    const { data: existing } = await db.from("distribution_records").select("id, collected_at, completed_at").eq("meal_id", d.meal_id).eq("table_id", d.table_id).maybeSingle();
    const now = new Date().toISOString();
    let patch: Record<string, unknown>;
    if (d.step === "collected") patch = { collected_at: now, collected_by: ctx.userId };
    else if (d.step === "completed") {
      patch = { completed_at: now, completed_by: ctx.userId };
      if (!existing?.collected_at) Object.assign(patch, { collected_at: now, collected_by: ctx.userId });
    } else patch = existing?.completed_at ? { completed_at: null, completed_by: null } : { collected_at: null, collected_by: null };
    const { error } = await db
      .from("distribution_records")
      .upsert({ institution_id: ctx.institution.id, meal_id: d.meal_id, table_id: d.table_id, ...patch }, { onConflict: "meal_id,table_id" });
    check(error);
    revalidatePath("/", "layout");
    return d.step === "undo" ? "Last step undone." : d.step === "collected" ? "Food marked as collected." : "Distribution marked complete.";
  });
}

export async function reportMissingMeal(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("teacher", "missingMeal.report");
    const d = parseForm(
      z.object({
        meal_id: uuid,
        table_id: z.string().optional().transform((v) => v || null),
        portions_missing: z.coerce.number().int().min(0).max(100),
        note: requiredText(400),
      }),
      fd,
    );
    const { error } = await ctx.supabase
      .from("missing_meal_reports")
      .insert({ ...d, institution_id: ctx.institution.id, reported_by: ctx.userId, status: "open" });
    check(error);
    revalidatePath("/", "layout");
    return "Report sent to the kitchen.";
  });
}
