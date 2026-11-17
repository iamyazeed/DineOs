"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/constants";
import type { ActionResult, Role } from "@/types/domain";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password is too short"),
  next: z.string().optional(),
});

export async function signIn(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password"), next: fd.get("next") ?? undefined });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { ok: false, message: "Invalid email or password." };
  const { data: memberships } = await supabase.from("memberships").select("role").eq("user_id", data.user.id);
  const roles = (memberships ?? []).map((m) => m.role as Role);
  if (roles.length === 0) {
    await supabase.auth.signOut();
    return { ok: false, message: "Your account has no CampusMeal role yet. Contact your administrator." };
  }
  const next = parsed.data.next;
  const target = next && next.startsWith("/") && !next.startsWith("//") && roles.some((r) => next.startsWith(ROLE_HOME[r])) ? next : ROLE_HOME[roles[0]];
  redirect(target);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
