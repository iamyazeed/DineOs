"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { institutionActionContext } from "@/lib/auth/guards";
import { check, parseForm, requiredText, run } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

export async function publishAnnouncement(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "announcement.publish");
    const d = parseForm(
      z.object({
        title: requiredText(140),
        body: z.string().trim().max(2000),
        kind: z.enum(["general", "emergency", "sponsored", "menu_change"]),
        "audience[]": z.array(z.enum(["student", "teacher", "chef"])).or(z.enum(["student", "teacher", "chef"]).transform((v) => [v])),
      }),
      fd,
    );
    const { error } = await ctx.supabase.from("announcements").insert({
      institution_id: ctx.institution.id,
      title: d.title,
      body: d.body,
      kind: d.kind,
      audience: d["audience[]"],
      created_by: ctx.userId,
    });
    check(error);
    revalidatePath("/", "layout");
    return "Announcement published.";
  });
}
