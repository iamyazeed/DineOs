import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { KV, PageHeader, Panel } from "@/components/ui/primitives";

export default async function PlatformSettings() {
  const ctx = await requireRole("super_admin");
  return (
    <>
      <PageHeader eyebrow="Platform" title="Platform settings" sub="Platform-wide configuration. Institution-specific defaults are managed by each institution admin." />
      <div className="mt-5" />
      <Panel title="Platform">
        <KV k="Signed in as" v={ctx.email} />
        <KV k="Tenant isolation" v="Row Level Security (database-enforced)" />
        <KV k="Document storage" v="Private bucket, per-institution folders" />
        <KV k="Service-role key" v={process.env.SUPABASE_SERVICE_ROLE_KEY ? "Configured (server only)" : "Not configured — account creation disabled"} />
        <KV k="Institutions" v={<Link className="underline" href="/super-admin/institutions">Manage</Link>} />
      </Panel>
    </>
  );
}
