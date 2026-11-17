import { requireRole } from "@/lib/auth/guards";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/utils";

export default async function AuditLogs() {
  const ctx = await requireRole("super_admin");
  const [{ data: logs }, { data: insts }] = await Promise.all([
    ctx.supabase.from("audit_logs").select("id, institution_id, action, entity, entity_id, details, created_at").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("institutions").select("id, name"),
  ]);
  const name = new Map((insts ?? []).map((i) => [i.id, i.name]));
  return (
    <>
      <PageHeader eyebrow="Governance" title="Audit logs" sub="Recorded automatically by database triggers on key operational tables." />
      <div className="mt-5" />
      <Panel>
        {(logs ?? []).length === 0 ? <EmptyState>No audit events yet.</EmptyState> : (
          <div className="tablewrap">
            <table className="data">
              <thead><tr><th>When</th><th>Institution</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                {(logs ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="text-[12px] text-faint">{fmtDateTime(l.created_at)}</td>
                    <td>{name.get(l.institution_id) ?? "—"}</td>
                    <td className="mono">{l.action}</td>
                    <td className="mono">{l.entity}</td>
                    <td className="mono text-[11.5px] text-dim">{l.details ? JSON.stringify(l.details) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
