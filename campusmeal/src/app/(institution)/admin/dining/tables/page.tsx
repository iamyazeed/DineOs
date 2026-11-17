import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getCampusStructure } from "@/features/meals/queries";
import { assignTable } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field, PageHeader, Panel } from "@/components/ui/primitives";

export default async function SeatAssignments() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const structure = await getCampusStructure(ctx.supabase, inst);
  const { data: tables } = await ctx.supabase
    .from("dining_tables")
    .select("id, code, capacity, active, hall:dining_halls(name)")
    .eq("institution_id", inst.id)
    .order("code");
  const seatedCount = new Map<string, number>();
  for (const s of structure.seats) seatedCount.set(s.table_id, (seatedCount.get(s.table_id) ?? 0) + 1);
  const seated = new Set(structure.seats.map((s) => s.student_id));
  const unseated = structure.students.filter((s) => s.active && !seated.has(s.id));
  const studentsSorted = [...structure.students].sort((a, b) => a.class_name.localeCompare(b.class_name) || a.roll_no - b.roll_no);
  const byTable = new Map<string, typeof structure.students>();
  const studentById = new Map(structure.students.map((s) => [s.id, s]));
  for (const seat of structure.seats) {
    const st = studentById.get(seat.student_id);
    if (st) byTable.set(seat.table_id, [...(byTable.get(seat.table_id) ?? []), st]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Seat assignments"
        sub="Fixed table assignments carry over every day. Moving a student ends the old assignment and keeps it in history."
        actions={<Link href="/admin/dining/halls" className="btn btn-ghost">← Halls & tables</Link>}
      />
      <div className="mt-5" />
      <div className="cols">
        <Panel title="Tables" sub="Open a table to see who sits there">
          <div className="tile-grid">
            {(tables ?? []).map((t) => {
              const cap = t.capacity ?? inst.default_table_capacity;
              const n = seatedCount.get(t.id) ?? 0;
              const hall = (Array.isArray(t.hall) ? t.hall[0] : t.hall) as { name: string } | null;
              return (
                <details key={t.id} className="tile disclosure">
                  <summary>
                    <div className="flex items-center justify-between">
                      <span className="code">{t.code}</span>
                      <span className={`mono text-[12px] ${n > cap ? "text-bad" : "text-dim"}`}>
                        {n}/{cap}
                      </span>
                    </div>
                    <div className="text-[11px] text-faint">{hall?.name}</div>
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-[11.5px]">
                    {(byTable.get(t.id) ?? []).map((s) => (
                      <li key={s.id}>
                        {s.full_name} <span className="text-faint">· {s.class_name} #{s.roll_no}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </Panel>
        <div>
          <Panel title="Assign or move a student">
            <ActionForm action={assignTable}>
              <Field label="Student">
                <select name="student_id" required>
                  {studentsSorted.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.class_name} #{s.roll_no} — {s.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Table">
                <select name="table_id" required>
                  {(tables ?? [])
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} ({seatedCount.get(t.id) ?? 0}/{t.capacity ?? inst.default_table_capacity})
                      </option>
                    ))}
                </select>
              </Field>
              <div>
                <SubmitButton>Save assignment</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
          <Panel title="Unseated students" sub="Not counted for meals until seated">
            {unseated.length === 0 ? (
              <EmptyState>Every active student has a table.</EmptyState>
            ) : (
              <ul className="text-[13px]">
                {unseated.map((s) => (
                  <li key={s.id} className="list-row">
                    {s.full_name} <span className="text-faint">{s.class_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
