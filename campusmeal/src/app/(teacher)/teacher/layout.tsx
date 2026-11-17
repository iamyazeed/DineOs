import { RoleShell } from "@/components/layouts/role-shell";
import { requireRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole("teacher");
  return <RoleShell ctx={ctx}>{children}</RoleShell>;
}
