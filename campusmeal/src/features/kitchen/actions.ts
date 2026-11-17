"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, institutionActionContext } from "@/lib/auth/guards";
import { check, optionalText, parseForm, requiredText, run, uuid } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;
const done = () => revalidatePath("/", "layout");

/** Chef updates preparation progress for a meal. */
export async function updatePreparation(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("chef", "prep.update");
    const d = parseForm(
      z.object({
        meal_id: uuid,
        status: z.enum(["not_started", "in_progress", "completed", "delayed"]),
        progress: z.coerce.number().int().min(0).max(100).optional(),
        delay_minutes: z.string().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().int().min(1).max(600).nullable()),
        delay_reason: optionalText(300),
      }),
      fd,
    );
    if (d.status === "delayed" && !d.delay_reason) throw new ActionError("Please describe the reason for the delay.");
    const progress = d.status === "completed" ? 100 : d.status === "not_started" ? 0 : d.progress ?? 50;
    const { error } = await ctx.supabase.from("preparation_tasks").upsert(
      {
        institution_id: ctx.institution.id,
        meal_id: d.meal_id,
        status: d.status,
        progress,
        delay_minutes: d.status === "delayed" ? d.delay_minutes : null,
        delay_reason: d.status === "delayed" ? d.delay_reason : null,
        updated_by: ctx.userId,
      },
      { onConflict: "meal_id" },
    );
    check(error);
    done();
    return "Preparation status updated — visible to the institution admin now.";
  });
}

/** Chef records hall delivery and kitchen-side distribution status. */
export async function updateDelivery(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("chef", "delivery.update");
    const d = parseForm(
      z.object({
        meal_id: uuid,
        hall_id: uuid,
        delivery_status: z.enum(["pending", "dispatched", "delivered"]),
        kitchen_distribution_status: z.enum(["pending", "serving", "completed"]),
      }),
      fd,
    );
    const { error } = await ctx.supabase
      .from("meal_deliveries")
      .upsert({ ...d, institution_id: ctx.institution.id, updated_by: ctx.userId }, { onConflict: "meal_id,hall_id" });
    check(error);
    done();
    return "Delivery status saved.";
  });
}

export async function recordIngredient(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("chef", "ingredients.record");
    const d = parseForm(
      z.object({
        kind: z.enum(["usage", "shortage"]),
        item_name: requiredText(80),
        unit: z.string().trim().max(12).optional().transform((v) => v || "kg"),
        quantity: z.coerce.number().positive().max(100000),
        note: optionalText(300),
        meal_id: z.string().optional().transform((v) => v || null),
      }),
      fd,
    );
    const db = ctx.supabase;
    let { data: item } = await db.from("ingredient_items").select("id").eq("institution_id", ctx.institution.id).ilike("name", d.item_name).maybeSingle();
    if (!item) {
      const ins = await db.from("ingredient_items").insert({ institution_id: ctx.institution.id, name: d.item_name, unit: d.unit }).select("id").single();
      check(ins.error);
      item = ins.data;
    }
    const { error } = await db.from("ingredient_transactions").insert({
      institution_id: ctx.institution.id,
      item_id: item!.id,
      kind: d.kind,
      quantity: d.quantity,
      note: d.note,
      meal_id: d.meal_id,
      created_by: ctx.userId,
    });
    check(error);
    done();
    return d.kind === "usage" ? "Ingredient usage recorded." : "Shortage reported to the institution admin.";
  });
}

export async function createServiceRequest(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("chef", "serviceRequest.create");
    const d = parseForm(
      z.object({
        category: z.enum(["electrical", "gas", "exhaust", "equipment", "ingredients", "support", "other"]),
        title: requiredText(120),
        details: optionalText(600),
        priority: z.enum(["low", "normal", "urgent"]),
      }),
      fd,
    );
    const { error } = await ctx.supabase
      .from("kitchen_service_requests")
      .insert({ ...d, institution_id: ctx.institution.id, created_by: ctx.userId, status: "open" });
    check(error);
    done();
    return "Service request submitted to the institution admin.";
  });
}

/** Chef acknowledges / resolves a missing-meal report raised by a teacher. */
export async function updateMissingReport(_: Prev, fd: FormData) {
  return run(async () => {
    const d = parseForm(z.object({ role: z.enum(["chef", "institution_admin"]), id: uuid, status: z.enum(["acknowledged", "resolved"]) }), fd);
    const ctx = await institutionActionContext(d.role, "missingMeal.resolve");
    const { error } = await ctx.supabase.from("missing_meal_reports").update({ status: d.status }).eq("id", d.id).eq("institution_id", ctx.institution.id);
    check(error);
    done();
    return `Report marked ${d.status}.`;
  });
}
