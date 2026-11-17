import { requireRole } from "@/lib/auth/guards";
import { getCampusStructure } from "@/features/meals/queries";
import { getSuppliers } from "@/features/suppliers/queries";
import { rotateAllSuppliers, setSupplier } from "@/features/suppliers/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDate, todayIn } from "@/lib/utils";

export default async function SupplierRotation() {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const [structure, current, history] = await Promise.all([
    getCampusStructure(db, inst),
    getSuppliers(db, inst.id, today),
    db
      .from("supplier_rotations")
      .select("id, period_start, period_end, table:dining_tables(code), student:students(full_name)")
      .eq("institution_id", inst.id)
      .order("period_start", { ascending: false })
      .limit(60),
  ]);
  const students = new Map(structure.students.map((s) => [s.id, s]));
  const tables = new Map<string, { code: string; hall: string; seated: string[] }>();
  for (const seat of structure.seats) {
    const t = tables.get(seat.table_id) ?? { code: seat.table_code, hall: seat.hall_name, seated: [] };
    t.seated.push(seat.student_id);
    tables.set(seat.table_id, t);
  }
  const rotByTable = new Map(current.rotations.map((r) => [r.table_id, r]));
  const sorted = [...tables.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  return (
    <>
      <PageHeader
        eyebrow="Dining"
        title="Supplier rotation"
        sub={`Each table has a designated student supplier who collects food. Rotation period: ${inst.supplier_rotation_days} days. Previous assignments are kept as history.`}
        actions={
          <ActionForm action={rotateAllSuppliers} inline confirm="Start a new rotation for every table whose period has ended?">
            <SubmitButton>Rotate expired tables</SubmitButton>
          </ActionForm>
        }
      />
      <div className="mt-5" />
      <Panel title="Current suppliers">
        {sorted.length === 0 ? (
          <EmptyState>No seated tables.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Current supplier</th>
                  <th>Period</th>
                  <th>Change supplier</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(([id, t]) => {
                  const r = rotByTable.get(id);
                  const mates = t.seated.map((sid) => students.get(sid)!).filter(Boolean).sort((a, b) => a.class_name.localeCompare(b.class_name) || a.roll_no - b.roll_no);
                  return (
                    <tr key={id}>
                      <td>
                        <span className="mono font-bold">{t.code}</span> <span className="text-[11.5px] text-faint">{t.hall}</span>
                      </td>
                      <td>{r ? r.student_name : <span className="text-bad">None</span>}</td>
                      <td className="text-[12px] text-dim">{r ? `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}` : "—"}</td>
                      <td>
                        <ActionForm action={setSupplier} inline>
                          <input type="hidden" name="table_id" value={id} />
                          <input type="hidden" name="period_start" value={today} />
                          <select name="student_id" className="input w-52" defaultValue={r?.student_id} aria-label="Supplier">
                            {mates.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.class_name} #{s.roll_no} {s.full_name}
                              </option>
                            ))}
                          </select>
                          <SubmitButton size="sm" variant="ghost">
                            Set from today
                          </SubmitButton>
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Rotation history">
        {(history.data ?? []).length === 0 ? (
          <EmptyState>No history yet.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Supplier</th>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {(history.data ?? []).map((h) => (
                  <tr key={h.id}>
                    <td className="mono">{(Array.isArray(h.table) ? h.table[0] : (h.table as { code: string } | null))?.code}</td>
                    <td>{(Array.isArray(h.student) ? h.student[0] : (h.student as { full_name: string } | null))?.full_name}</td>
                    <td>{fmtDate(h.period_start)}</td>
                    <td>{fmtDate(h.period_end)}</td>
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
