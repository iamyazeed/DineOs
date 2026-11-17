import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { getSuppliers } from "@/features/suppliers/queries";
import { assignSubstitute } from "@/features/suppliers/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import type { PageProps } from "@/types/page";

export default async function SubstituteSupplier({ searchParams }: PageProps) {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const { date, today, meals, selected } = await resolveMealSelection(db, inst, await searchParams);
  const header = (
    <PageHeader eyebrow="Dining" title="Substitute supplier" sub="When a table's designated supplier is absent, pick a substitute (next by class roll number is suggested). The original rotation stays unchanged." />
  );
  if (!selected)
    return (
      <>
        {header}
        <MealPicker basePath="/teacher/suppliers/substitute" date={date} today={today} meals={meals} />
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      </>
    );
  const [b, sup] = await Promise.all([getMealBreakdown(db, inst, selected), getSuppliers(db, inst.id, date, selected.id)]);
  const rotByTable = new Map(sup.rotations.map((r) => [r.table_id, r]));
  const rows = b.byTable.map((t) => {
    const r = rotByTable.get(t.key);
    const supplier = r ? t.students.find((s) => s.id === r.student_id) : undefined;
    const away = supplier ? supplier.state === "cancelled" || supplier.state === "absent" : false;
    const present = t.students.filter((s) => s.state === "regular" || s.state === "separate");
    // Suggest the next present student after the supplier by roll number.
    const ordered = [...present].sort((a, z) => a.roll_no - z.roll_no);
    const suggestion = supplier ? ordered.find((s) => s.roll_no > supplier.roll_no) ?? ordered[0] : ordered[0];
    return { t, r, supplier, away, present: ordered, suggestion, sub: sup.byTable.get(t.key)?.substitute };
  });
  const needing = rows.filter((x) => x.away);
  return (
    <>
      {header}
      <MealPicker basePath="/teacher/suppliers/substitute" date={date} today={today} meals={meals} selectedId={selected.id} />
      <Panel title="Tables whose supplier is absent" sub={`${needing.length} table(s) need a substitute`}>
        {needing.length === 0 ? (
          <EmptyState>Every designated supplier is attending this meal.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Designated supplier</th>
                  <th>Substitute</th>
                </tr>
              </thead>
              <tbody>
                {needing.map(({ t, r, supplier, present, suggestion, sub }) => (
                  <tr key={t.key}>
                    <td className="mono font-bold">{t.label}</td>
                    <td>
                      {supplier?.full_name} <Pill tone="bad">{supplier?.state}</Pill>
                    </td>
                    <td>
                      {sub && (
                        <div className="mb-1">
                          <Pill tone="good">Assigned: {sub}</Pill>
                        </div>
                      )}
                      <ActionForm action={assignSubstitute} inline>
                        <input type="hidden" name="rotation_id" value={r!.id} />
                        <input type="hidden" name="meal_id" value={selected.id} />
                        <input type="hidden" name="reason" value={`Designated supplier ${supplier?.state}`} />
                        <select name="substitute_student_id" className="input w-56" defaultValue={suggestion?.id} aria-label="Substitute">
                          {present.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.class_name} #{s.roll_no} {s.full_name}
                            </option>
                          ))}
                        </select>
                        <SubmitButton size="sm">Assign</SubmitButton>
                      </ActionForm>
                    </td>
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
