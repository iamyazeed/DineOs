import { requireRole } from "@/lib/auth/guards";
import { EmptyState, KV, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { todayIn } from "@/lib/utils";

interface Row {
  table_code: string;
  hall_name: string;
  capacity: number;
  mate_name: string;
  mate_roll: number;
  mate_class: string;
  is_me: boolean;
  is_supplier: boolean;
}

export default async function MyTable() {
  const ctx = await requireRole("student");
  const { data, error } = await ctx.supabase.rpc("my_table", { p_date: todayIn(ctx.institution!.timezone) });
  const rows = (data ?? []) as Row[];
  const first = rows[0];
  const supplier = rows.find((r) => r.is_supplier);
  return (
    <>
      <PageHeader eyebrow="Dining" title="My table" sub="Your fixed seat. It stays the same every day unless the administrator changes it." />
      <div className="mt-5" />
      {error || !first ? (
        <Panel>
          <EmptyState>You haven&apos;t been assigned a table yet.</EmptyState>
        </Panel>
      ) : (
        <div className="cols">
          <Panel title={`Table ${first.table_code}`} sub={first.hall_name}>
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th className="num">Roll</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="font-semibold">{r.mate_name}</td>
                      <td className="text-dim">{r.mate_class}</td>
                      <td className="num">{r.mate_roll}</td>
                      <td>
                        {r.is_me && <Pill tone="teal">You</Pill>} {r.is_supplier && <Pill tone="warn">Supplier</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Details">
            <KV k="Dining hall" v={first.hall_name} />
            <KV k="Table" v={first.table_code} />
            <KV k="Seats" v={`${rows.length} / ${first.capacity}`} />
            <KV k="Designated supplier" v={supplier?.mate_name ?? "Not assigned"} />
            <p className="mt-3 text-[12px] text-faint">The supplier collects food for the table. If they are absent, your teacher assigns a substitute.</p>
          </Panel>
        </div>
      )}
    </>
  );
}
