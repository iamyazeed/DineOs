"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, institutionActionContext } from "@/lib/auth/guards";
import { check, optionalText, parseForm, requiredText, run, uuid } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;

/** Class teacher submits a separate-food requirement to the institution admin. */
export async function createSeparateFoodRequest(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("teacher", "separateFood.request");
    const d = parseForm(
      z.object({
        class_id: uuid,
        meal_id: uuid,
        "student_ids[]": z.array(uuid).or(uuid.transform((v) => [v])),
        portions: z.coerce.number().int().min(1).max(500),
        requirement: requiredText(300),
        dietary_info: optionalText(300),
        reason: optionalText(300),
      }),
      fd,
    );
    const db = ctx.supabase;
    const { data: cls } = await db.from("classes").select("id").eq("id", d.class_id).eq("teacher_id", ctx.userId).maybeSingle();
    if (!cls) throw new ActionError("You can only submit requests for your own class.");
    const studentIds = d["student_ids[]"];
    const { count } = await db.from("students").select("id", { count: "exact", head: true }).eq("class_id", d.class_id).in("id", studentIds);
    if (count !== studentIds.length) throw new ActionError("All selected students must belong to this class.");
    if (d.portions < studentIds.length) throw new ActionError("Portions cannot be fewer than the number of students selected.");
    const { data: req, error } = await db
      .from("separate_food_requests")
      .insert({
        institution_id: ctx.institution.id,
        class_id: d.class_id,
        meal_id: d.meal_id,
        portions: d.portions,
        requirement: d.requirement,
        dietary_info: d.dietary_info,
        reason: d.reason,
      })
      .select("id")
      .single();
    check(error);
    const { error: e2 } = await db
      .from("separate_food_request_students")
      .insert(studentIds.map((student_id) => ({ request_id: req!.id, student_id, institution_id: ctx.institution.id })));
    check(e2);
    revalidatePath("/", "layout");
    return "Request sent to the institution administrator for review.";
  });
}

export async function reviewSeparateFoodRequest(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "separateFood.review");
    const d = parseForm(z.object({ id: uuid, decision: z.enum(["approved", "rejected"]), review_note: optionalText(300) }), fd);
    const { error, count } = await ctx.supabase
      .from("separate_food_requests")
      .update({ status: d.decision, review_note: d.review_note }, { count: "exact" })
      .eq("id", d.id)
      .eq("institution_id", ctx.institution.id)
      .eq("status", "pending");
    check(error);
    if (!count) throw new ActionError("This request was already reviewed.");
    revalidatePath("/", "layout");
    return d.decision === "approved" ? "Approved — now visible to the kitchen as separate portions." : "Request rejected.";
  });
}
