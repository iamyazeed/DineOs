import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission } from "@/lib/auth/permissions";
import type { Institution, Role } from "@/types/domain";

export interface Membership {
  role: Role;
  institution_id: string | null;
}

export interface SessionContext {
  userId: string;
  email: string;
  fullName: string;
  memberships: Membership[];
}

export interface RoleContext extends SessionContext {
  role: Role;
  institution: Institution | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/** Signed-in user + memberships, or null. Cached per request. */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    supabase.from("memberships").select("role, institution_id").eq("user_id", auth.user.id),
  ]);
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    fullName: profile?.full_name || auth.user.email || "User",
    memberships: (memberships ?? []) as Membership[],
  };
});

/** Load the context for a role-scoped area; redirects if not permitted. */
export const requireRole = cache(async (role: Role): Promise<RoleContext> => {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  const membership = session.memberships.find((m) => m.role === role);
  if (!membership) redirect("/unauthorized");
  const supabase = await createClient();
  let institution: Institution | null = null;
  if (membership.institution_id) {
    const { data } = await supabase.from("institutions").select("*").eq("id", membership.institution_id).single();
    institution = data as Institution | null;
    if (!institution) redirect("/unauthorized");
  }
  return { ...session, role, institution, supabase };
});

/** For server actions: role context + permission check, throwing on failure. */
export async function actionContext(role: Role, permission: Permission) {
  const session = await getSessionContext();
  const membership = session?.memberships.find((m) => m.role === role);
  if (!session || !membership || !can(role, permission)) {
    throw new ActionError("You are not permitted to perform this action.");
  }
  const supabase = await createClient();
  let institution: Institution | null = null;
  if (membership.institution_id) {
    const { data } = await supabase.from("institutions").select("*").eq("id", membership.institution_id).single();
    institution = data as Institution | null;
  }
  return { ...session, role, institution, supabase };
}

/** Same as actionContext but guarantees an institution (all non-super roles). */
export async function institutionActionContext(role: Exclude<Role, "super_admin">, permission: Permission) {
  const ctx = await actionContext(role, permission);
  if (!ctx.institution) throw new ActionError("No institution found for your account.");
  return { ...ctx, institution: ctx.institution };
}

export class ActionError extends Error {}
