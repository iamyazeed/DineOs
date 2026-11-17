"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, actionContext } from "@/lib/auth/guards";
import { check, optionalText, parseForm, requiredText, run, uuid } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Message between an institution admin and university administration,
 * optionally with a document stored privately under <institution_id>/ in Storage.
 */
export async function sendInstitutionalMessage(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const d = parseForm(
      z.object({
        role: z.enum(["institution_admin", "super_admin"]),
        institution_id: z.string().optional(),
        subject: optionalText(140),
        body: requiredText(4000),
      }),
      fd,
    );
    const ctx = await actionContext(d.role, "university.message");
    const institutionId = d.role === "institution_admin" ? ctx.institution?.id : uuid.parse(d.institution_id);
    if (!institutionId) throw new ActionError("Choose an institution.");
    const { data: msg, error } = await ctx.supabase
      .from("institutional_messages")
      .insert({
        institution_id: institutionId,
        direction: d.role === "institution_admin" ? "to_university" : "to_institution",
        subject: d.subject,
        body: d.body,
        sender_id: ctx.userId,
      })
      .select("id")
      .single();
    check(error);
    const file = fd.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) throw new ActionError("Files must be 10 MB or smaller. The message was sent without it.");
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-100);
      const path = `${institutionId}/${crypto.randomUUID()}-${safe}`;
      const up = await ctx.supabase.storage.from("documents").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw new ActionError(`Message sent, but the upload failed: ${up.error.message}`);
      const { error: dErr } = await ctx.supabase.from("documents").insert({
        institution_id: institutionId,
        message_id: msg!.id,
        storage_path: path,
        file_name: file.name.slice(0, 200),
        size_bytes: file.size,
        uploaded_by: ctx.userId,
      });
      check(dErr);
    }
    revalidatePath("/", "layout");
    return "Message sent.";
  });
}
