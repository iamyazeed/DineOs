import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, type Permission } from "@/lib/auth/permissions";
import { DEMO_COOKIE, DEMO_INSTITUTION, readDemoToken } from "@/lib/auth/demo";
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
  isDemo?: boolean;
}

type Db = Awaited<ReturnType<typeof createClient>>;

export interface RoleContext extends SessionContext {
  role: Role;
  institution: Institution | null;
  supabase: Db;
}

/** Demo sessions have no Supabase Auth user, so they read with the service-role client when it exists. */
async function dbFor(session: SessionContext): Promise<Db> {
  if (session.isDemo) {
    const admin = createAdminClient();
    if (admin) return admin as unknown as Db;
  }
  return createClient();
}

async function loadInstitution(supabase: Db, id: string, demo: boolean): Promise<Institution | null> {
  const { data } = await supabase.from("institutions").select("*").eq("id", id).maybeSingle();
  if (data) return data as Institution;
  return demo && id === DEMO_INSTITUTION.id ? DEMO_INSTITUTION : null;
}

/** Signed-in user + memberships, or null. Cached per request. */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const demo = await readDemoToken((await cookies()).get(DEMO_COOKIE)?.value);
  if (demo) {
    return {
      userId: demo.userId,
      email: demo.email,
      fullName: demo.fullName,
      memberships: [{ role: demo.role, institution_id: demo.institutionId }],
      isDemo: true,
    };
  }
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
  const supabase = await dbFor(session);
  let institution: Institution | null = null;
  if (membership.institution_id) {
    institution = await loadInstitution(supabase, membership.institution_id, !!session.isDemo);
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
  const supabase = await dbFor(session);
  let institution: Institution | null = null;
  if (membership.institution_id) {
    institution = await loadInstitution(supabase, membership.institution_id, !!session.isDemo);
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
