import { z } from "zod";
import { ActionError } from "@/lib/auth/guards";
import type { ActionResult } from "@/types/domain";

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
export const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time");
export const text = (max = 500) => z.string().trim().max(max);
export const requiredText = (max = 500) => z.string().trim().min(1, "Required").max(max);
export const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export function formObject(fd: FormData) {
  const out: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const key of new Set(fd.keys())) {
    const all = fd.getAll(key);
    out[key] = key.endsWith("[]") ? all : all[0];
  }
  return out;
}

/** Parse form data with a schema; throws ActionError with a readable message. */
export function parseForm<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const r = schema.safeParse(formObject(fd));
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new ActionError(`${issue.path.join(".") || "Input"}: ${issue.message}`);
  }
  return r.data;
}

/** Wrap a server action body so every failure becomes a user-visible message. */
export async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, message: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // let Next redirects through
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Throw a friendly error for a Supabase error response. */
export function check(error: { message: string; code?: string } | null, friendly?: string) {
  if (!error) return;
  if (error.code === "23505") throw new ActionError(friendly ?? "This record already exists.");
  if (error.code === "42501") throw new ActionError("Permission denied by database policy.");
  // Messages raised by our own triggers are written for users.
  throw new ActionError(error.message || friendly || "Database error");
}
