"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { institutionActionContext } from "@/lib/auth/guards";
import { check, optionalText, parseForm, run, uuid } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

/** Admin reviews a kitchen service request (no staff assignment by design). */
export async function updateServiceRequest(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "serviceRequest.review");
    const d = parseForm(
      z.object({ id: uuid, status: z.enum(["open", "approved", "rejected", "in_progress", "resolved"]), admin_note: optionalText(500) }),
      fd,
    );
    const { error } = await ctx.supabase
      .from("kitchen_service_requests")
      .update({ status: d.status, admin_note: d.admin_note })
      .eq("id", d.id)
      .eq("institution_id", ctx.institution.id);
    check(error);
    revalidatePath("/", "layout");
    return "Request updated.";
  });
}
