"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, actionContext } from "@/lib/auth/guards";
import { check, parseForm, requiredText, run, uuid } from "@/lib/validations";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;

export async function createInstitution(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await actionContext("super_admin", "institutions.manage");
    const d = parseForm(
      z.object({
        name: requiredText(120),
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,16}$/, "2–16 letters, digits or dashes"),
        timezone: requiredText(60),
        admin_email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
        admin_name: z.string().trim().max(120).optional(),
        admin_password: z.string().optional(),
      }),
      fd,
    );
    try {
      new Intl.DateTimeFormat("en", { timeZone: d.timezone });
    } catch {
      throw new ActionError("Unknown timezone.");
    }
    const { data: inst, error } = await ctx.supabase
      .from("institutions")
      .insert({ name: d.name, code: d.code, timezone: d.timezone })
      .select("id")
      .single();
    check(error, "That institution code is already in use.");
    if (d.admin_email) {
      if (!d.admin_password || d.admin_password.length < 6) throw new ActionError("Institution created. Admin password must be at least 6 characters — add the admin again below.");
      const admin = createAdminClient();
      if (!admin) throw new ActionError("Institution created, but adding an admin login needs SUPABASE_SERVICE_ROLE_KEY on the server.");
      const { data: u, error: uErr } = await admin.auth.admin.createUser({
        email: d.admin_email,
        password: d.admin_password,
        email_confirm: true,
        user_metadata: { full_name: d.admin_name || d.admin_email },
      });
      if (uErr || !u.user) throw new ActionError(`Institution created, but the admin login failed: ${uErr?.message}`);
      const { error: mErr } = await admin.from("memberships").insert({ user_id: u.user.id, institution_id: inst!.id, role: "institution_admin" });
      check(mErr);
    }
    revalidatePath("/", "layout");
    return `${d.name} registered${d.admin_email ? " with its administrator" : ""}.`;
  });
}

export async function setInstitutionActive(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await actionContext("super_admin", "institutions.manage");
    const d = parseForm(z.object({ id: uuid, active: z.enum(["true", "false"]) }), fd);
    const { error } = await ctx.supabase.from("institutions").update({ active: d.active === "true" }).eq("id", d.id);
    check(error);
    revalidatePath("/", "layout");
    return d.active === "true" ? "Institution activated." : "Institution suspended.";
  });
}
